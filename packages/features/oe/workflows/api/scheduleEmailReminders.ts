/* Schedule any workflow reminder that falls within 72 hours for email */
import type { NextApiRequest, NextApiResponse } from "next";
import { v4 as uuidv4 } from "uuid";

import dayjs from "@calcom/dayjs";
import { getCalEventResponses } from "@calcom/features/bookings/lib/getCalEventResponses";
import logger from "@calcom/lib/logger";
import { defaultHandler } from "@calcom/lib/server";
import { getTimeFormatStringFromUserTimeFormat } from "@calcom/lib/timeFormat";
import prisma from "@calcom/prisma";
import { WorkflowActions, WorkflowMethods, WorkflowTemplates } from "@calcom/prisma/enums";
import { bookingMetadataSchema } from "@calcom/prisma/zod-utils";

import type { PartialWorkflowReminder } from "../lib/getWorkflowReminders";
import {
  fetchRemindersToBeCancelled,
  fetchRemindersToBeDeleted,
  fetchUnscheduledReminders,
} from "../lib/getWorkflowReminders";
import { getiCalEventAsString } from "../lib/getiCalEventAsString";
import {
  cancelScheduledEmail,
  deleteScheduledSend,
  getBatchId,
  sendSendgridMail,
} from "../lib/reminders/providers/sendgridProvider";
import type { VariablesType } from "../lib/reminders/templates/customTemplate";
import customTemplate from "../lib/reminders/templates/customTemplate";
import emailReminderTemplate from "../lib/reminders/templates/emailReminderTemplate";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_EMAIL) {
    res.status(405).json({ message: "No SendGrid API key or email" });
    return;
  }

  // delete batch_ids with already past scheduled date from scheduled_sends
  const remindersToBeDeleted: { referenceId: string | null }[] = await fetchRemindersToBeDeleted();

  const deletePromises = remindersToBeDeleted.map((reminder) => {
    return deleteScheduledSend(reminder.referenceId);
  });

  Promise.allSettled(deletePromises).then((results) => {
    results.forEach((result) => {
      if (result.status === "rejected") {
        logger.error(`Error deleting batch id from scheduled_sends: ${result.reason}`);
      }
    });
  });

  //delete workflow reminders with past scheduled date
  await prisma.workflowReminder.deleteMany({
    where: {
      method: WorkflowMethods.EMAIL,
      scheduledDate: {
        lte: dayjs().toISOString(),
      },
    },
  });

  //cancel reminders for cancelled/rescheduled bookings that are scheduled within the next hour
  // Retrieve reminders to cancel
  const remindersToCancel: { referenceId: string | null; id: number }[] = await fetchRemindersToBeCancelled();

  // Initialize an array to store cancel and update promises
  const cancelUpdatePromises: Promise<any>[] = remindersToCancel.flatMap((reminder) => {
    const cancelPromise = cancelScheduledEmail(reminder.referenceId);
    const updatePromise = prisma.workflowReminder.update({
      where: {
        id: reminder.id,
      },
      data: {
        scheduled: false,
      },
    });
    return [cancelPromise, updatePromise];
  });

  // Execute all promises concurrently and handle results
  await Promise.allSettled(cancelUpdatePromises).then((results) => {
    results.forEach((result) => {
      if (result.status === "rejected") {
        logger.error(`Error cancelling scheduled_sends: ${result.reason}`);
      }
    });
  });

  // schedule all unscheduled reminders within the next 72 hours
  const sendEmailPromises: Promise<any>[] = [];

  const unscheduledReminders: PartialWorkflowReminder[] = await fetchUnscheduledReminders();

  if (!unscheduledReminders.length) {
    res.status(200).json({ message: "No Emails to schedule" });
    return;
  }

  for (const reminder of unscheduledReminders) {
    if (!reminder.booking) {
      continue;
    }
    if (!reminder.isMandatoryReminder && reminder.workflowStep) {
      try {
        let sendTo;

        switch (reminder.workflowStep.action) {
          case WorkflowActions.EMAIL_HOST:
            sendTo = reminder.booking.user?.email;
            break;
          case WorkflowActions.EMAIL_ATTENDEE:
            sendTo = reminder.booking.attendees[0].email;
            break;
          case WorkflowActions.EMAIL_ADDRESS:
            sendTo = reminder.workflowStep.sendTo;
        }

        const name =
          reminder.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE
            ? reminder.booking.attendees[0].name
            : reminder.booking.user?.name;

        const attendeeName =
          reminder.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE
            ? reminder.booking.user?.name
            : reminder.booking.attendees[0].name;

        const timeZone =
          reminder.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE
            ? reminder.booking.attendees[0].timeZone
            : reminder.booking.user?.timeZone;

        const locale =
          reminder.workflowStep.action === WorkflowActions.EMAIL_ATTENDEE ||
          reminder.workflowStep.action === WorkflowActions.SMS_ATTENDEE
            ? reminder.booking.attendees[0].locale
            : reminder.booking.user?.locale;

        let emailContent = {
          emailSubject: reminder.workflowStep.emailSubject || "",
          emailBody: `<body style="white-space: pre-wrap;">${
            reminder.workflowStep.reminderBody || ""
          }</body>`,
        };

        let emailBodyEmpty = false;

        if (reminder.workflowStep.reminderBody) {
          const { responses } = getCalEventResponses({
            bookingFields: reminder.booking.eventType?.bookingFields ?? null,
            booking: reminder.booking,
          });

          const variables: VariablesType = {
            eventName: reminder.booking.eventType?.title || "",
            organizerName: reminder.booking.user?.name || "",
            attendeeName: reminder.booking.attendees[0].name,
            attendeeEmail: reminder.booking.attendees[0].email,
            eventDate: dayjs(reminder.booking.startTime).tz(timeZone),
            eventEndTime: dayjs(reminder.booking?.endTime).tz(timeZone),
            timeZone: timeZone,
            location: reminder.booking.location || "",
            additionalNotes: reminder.booking.description,
            responses: responses,
            meetingUrl: bookingMetadataSchema.parse(reminder.booking.metadata || {})?.videoCallUrl,
            cancelLink: `/booking/${reminder.booking.uid}?cancel=true`,
            rescheduleLink: `/${reminder.booking.user?.username}/${reminder.booking.eventType?.slug}?rescheduleUid=${reminder.booking.uid}`,
          };
          const emailLocale = locale || "en";
          const emailSubject = customTemplate(
            reminder.workflowStep.emailSubject || "",
            variables,
            emailLocale,
            getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat),
            !!reminder.booking.user?.hideBranding
          ).text;
          emailContent.emailSubject = emailSubject;
          emailContent.emailBody = customTemplate(
            reminder.workflowStep.reminderBody || "",
            variables,
            emailLocale,
            getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat),
            !!reminder.booking.user?.hideBranding
          ).html;

          emailBodyEmpty =
            customTemplate(
              reminder.workflowStep.reminderBody || "",
              variables,
              emailLocale,
              getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat)
            ).text.length === 0;
        } else if (reminder.workflowStep.template === WorkflowTemplates.REMINDER) {
          emailContent = emailReminderTemplate(
            false,
            reminder.workflowStep.action,
            getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat),
            reminder.booking.startTime.toISOString() || "",
            reminder.booking.endTime.toISOString() || "",
            reminder.booking.eventType?.title || "",
            timeZone || "",
            attendeeName || "",
            name || "",
            !!reminder.booking.user?.hideBranding
          );
        }

        if (emailContent.emailSubject.length > 0 && !emailBodyEmpty && sendTo) {
          const batchId = await getBatchId();

          if (reminder.workflowStep.action !== WorkflowActions.EMAIL_ADDRESS) {
            sendEmailPromises.push(
              sendSendgridMail(
                {
                  to: sendTo,
                  subject: emailContent.emailSubject,
                  html: emailContent.emailBody,
                  batchId: batchId,
                  sendAt: dayjs(reminder.scheduledDate).unix(),
                  replyTo: reminder.booking.user?.email,
                  attachments: reminder.workflowStep.includeCalendarEvent
                    ? [
                        {
                          content: Buffer.from(getiCalEventAsString(reminder.booking) || "").toString(
                            "base64"
                          ),
                          filename: "event.ics",
                          type: "text/calendar; method=REQUEST",
                          disposition: "attachment",
                          contentId: uuidv4(),
                        },
                      ]
                    : undefined,
                },
                { sender: reminder.workflowStep.sender }
              )
            );
          }

          await prisma.workflowReminder.update({
            where: {
              id: reminder.id,
            },
            data: {
              scheduled: true,
              referenceId: batchId,
            },
          });
        }
      } catch (error) {
        logger.error(`Error scheduling Email with error ${error}`);
      }
    } else if (reminder.isMandatoryReminder) {
      for (const reminder of unscheduledReminders) {
        if (reminder.booking) {
          const sendTo = reminder.booking.attendees[0]?.email;
          const name = reminder.booking.attendees[0]?.name;
          const attendeeName = reminder.booking.user?.name;
          const timeZone = reminder.booking.attendees[0]?.timeZone;

          const emailContent = emailReminderTemplate(
            false,
            WorkflowActions.EMAIL_ATTENDEE,
            getTimeFormatStringFromUserTimeFormat(reminder.booking.user?.timeFormat),
            reminder.booking.startTime?.toISOString() || "",
            reminder.booking.endTime?.toISOString() || "",
            reminder.booking.eventType?.title || "",
            timeZone || "",
            attendeeName || "",
            name || "",
            !!reminder.booking.user?.hideBranding
          );

          if (emailContent.emailSubject && sendTo) {
            try {
              const batchId = await getBatchId();

              sendEmailPromises.push(
                sendSendgridMail(
                  {
                    to: sendTo,
                    subject: emailContent.emailSubject,
                    html: emailContent.emailBody,
                    batchId,
                    sendAt: dayjs(reminder.scheduledDate).unix(),
                    replyTo: reminder.booking.user?.email,
                  },
                  { sender: reminder.workflowStep?.sender }
                )
              );

              await prisma.workflowReminder.update({
                where: {
                  id: reminder.id,
                },
                data: {
                  scheduled: true,
                  referenceId: batchId,
                },
              });
            } catch (error) {
              logger.error(`Error updating scheduled reminder with ID ${reminder.id}: ${error}`);
            }
          }
        }
      }
    }
  }

  Promise.allSettled(sendEmailPromises).then((results) => {
    results.forEach((result) => {
      if (result.status === "rejected") {
        logger.error("Email sending failed", result.reason);
      }
    });
  });

  res.status(200).json({ message: `${unscheduledReminders.length} Emails to schedule` });
}

export default defaultHandler({
  GET: Promise.resolve({ default: handler }),
});
