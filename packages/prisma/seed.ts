import type { Prisma } from "@prisma/client";
import { uuid } from "short-uuid";
import type z from "zod";

import dailyMeta from "@calcom/app-store/dailyvideo/_metadata";
import googleMeetMeta from "@calcom/app-store/googlevideo/_metadata";
import zoomMeta from "@calcom/app-store/zoomvideo/_metadata";
import dayjs from "@calcom/dayjs";
import { BookingStatus, MembershipRole } from "@calcom/prisma/enums";

import prisma from ".";
import mainAppStore from "./seed-app-store";
import { createUserAndEventType } from "./seed-utils";
import type { teamMetadataSchema } from "./zod-utils";

async function createTeamAndAddUsers(
  teamInput: Prisma.TeamCreateInput,
  users: { id: number; username: string; role?: MembershipRole }[] = []
) {
  const checkUnpublishedTeam = async (slug: string) => {
    return await prisma.team.findFirst({
      where: {
        metadata: {
          path: ["requestedSlug"],
          equals: slug,
        },
      },
    });
  };
  const createTeam = async (team: Prisma.TeamCreateInput) => {
    try {
      const requestedSlug = (team.metadata as z.infer<typeof teamMetadataSchema>)?.requestedSlug;
      if (requestedSlug) {
        const unpublishedTeam = await checkUnpublishedTeam(requestedSlug);
        if (unpublishedTeam) {
          throw Error("Unique constraint failed on the fields");
        }
      }
      return await prisma.team.create({
        data: {
          ...team,
        },
      });
    } catch (_err) {
      if (_err instanceof Error && _err.message.indexOf("Unique constraint failed on the fields") !== -1) {
        console.log(`Team '${team.name}' already exists, skipping.`);
        return;
      }
      throw _err;
    }
  };

  const team = await createTeam(teamInput);
  if (!team) {
    return;
  }

  console.log(
    `🏢 Created team '${teamInput.name}' - ${process.env.NEXT_PUBLIC_WEBAPP_URL}/team/${team.slug}`
  );

  for (const user of users) {
    const { role = MembershipRole.OWNER, id, username } = user;
    await prisma.membership.create({
      data: {
        teamId: team.id,
        userId: id,
        role: role,
        accepted: true,
      },
    });
    console.log(`\t👤 Added '${teamInput.name}' membership for '${username}' with role '${role}'`);
  }

  return team;
}

async function main() {
  await createUserAndEventType({
    user: {
      email: "delete-me@example.com",
      password: "delete-me",
      username: "delete-me",
      name: "delete-me",
    },
  });

  await createUserAndEventType({
    user: {
      email: "onboarding@example.com",
      password: "onboarding",
      username: "onboarding",
      name: "onboarding",
      completedOnboarding: false,
    },
  });

  await createUserAndEventType({
    user: {
      email: "free-first-hidden@example.com",
      password: "free-first-hidden",
      username: "free-first-hidden",
      name: "Free First Hidden Example",
    },
    eventTypes: [
      {
        title: "30min",
        slug: "30min",
        length: 30,
        hidden: true,
      },
      {
        title: "60min",
        slug: "60min",
        length: 30,
      },
    ],
  });
  await createUserAndEventType({
    user: {
      email: "pro@example.com",
      name: "Pro Example",
      password: "pro",
      username: "pro",
      theme: "light",
    },
    eventTypes: [
      {
        title: "30min",
        slug: "30min",
        length: 30,
        _bookings: [
          {
            uid: uuid(),
            title: "30min",
            startTime: dayjs().add(1, "day").toDate(),
            endTime: dayjs().add(1, "day").add(30, "minutes").toDate(),
          },
          {
            uid: uuid(),
            title: "30min",
            startTime: dayjs().add(2, "day").toDate(),
            endTime: dayjs().add(2, "day").add(30, "minutes").toDate(),
            status: BookingStatus.PENDING,
          },
          {
            // hardcode UID so that we can easily test rescheduling in embed
            uid: "qm3kwt3aTnVD7vmP9tiT2f",
            title: "30min Seeded Booking",
            startTime: dayjs().add(3, "day").toDate(),
            endTime: dayjs().add(3, "day").add(30, "minutes").toDate(),
            status: BookingStatus.PENDING,
          },
        ],
      },
      {
        title: "60min",
        slug: "60min",
        length: 60,
      },
      {
        title: "Multiple duration",
        slug: "multiple-duration",
        length: 75,
        metadata: {
          multipleDuration: [30, 75, 90],
        },
      },
      {
        title: "paid",
        slug: "paid",
        length: 60,
        price: 100,
      },
      {
        title: "In person meeting",
        slug: "in-person",
        length: 60,
        locations: [{ type: "inPerson", address: "London" }],
      },
      {
        title: "Zoom Event",
        slug: "zoom",
        length: 60,
        locations: [{ type: zoomMeta.appData?.location?.type }],
      },
      {
        title: "Daily Event",
        slug: "daily",
        length: 60,
        locations: [{ type: dailyMeta.appData?.location?.type }],
      },
      {
        title: "Google Meet",
        slug: "google-meet",
        length: 60,
        locations: [{ type: googleMeetMeta.appData?.location?.type }],
      },
      {
        title: "Yoga class",
        slug: "yoga-class",
        length: 30,
        recurringEvent: { freq: 2, count: 12, interval: 1 },
        _bookings: [
          {
            uid: uuid(),
            title: "Yoga class",
            recurringEventId: Buffer.from("yoga-class").toString("base64"),
            startTime: dayjs().add(1, "day").toDate(),
            endTime: dayjs().add(1, "day").add(30, "minutes").toDate(),
            status: BookingStatus.ACCEPTED,
          },
          {
            uid: uuid(),
            title: "Yoga class",
            recurringEventId: Buffer.from("yoga-class").toString("base64"),
            startTime: dayjs().add(1, "day").add(1, "week").toDate(),
            endTime: dayjs().add(1, "day").add(1, "week").add(30, "minutes").toDate(),
            status: BookingStatus.ACCEPTED,
          },
          {
            uid: uuid(),
            title: "Yoga class",
            recurringEventId: Buffer.from("yoga-class").toString("base64"),
            startTime: dayjs().add(1, "day").add(2, "week").toDate(),
            endTime: dayjs().add(1, "day").add(2, "week").add(30, "minutes").toDate(),
            status: BookingStatus.ACCEPTED,
          },
          {
            uid: uuid(),
            title: "Yoga class",
            recurringEventId: Buffer.from("yoga-class").toString("base64"),
            startTime: dayjs().add(1, "day").add(3, "week").toDate(),
            endTime: dayjs().add(1, "day").add(3, "week").add(30, "minutes").toDate(),
            status: BookingStatus.ACCEPTED,
          },
          {
            uid: uuid(),
            title: "Yoga class",
            recurringEventId: Buffer.from("yoga-class").toString("base64"),
            startTime: dayjs().add(1, "day").add(4, "week").toDate(),
            endTime: dayjs().add(1, "day").add(4, "week").add(30, "minutes").toDate(),
            status: BookingStatus.ACCEPTED,
          },
          {
            uid: uuid(),
            title: "Yoga class",
            recurringEventId: Buffer.from("yoga-class").toString("base64"),
            startTime: dayjs().add(1, "day").add(5, "week").toDate(),
            endTime: dayjs().add(1, "day").add(5, "week").add(30, "minutes").toDate(),
            status: BookingStatus.ACCEPTED,
          },
          {
            uid: uuid(),
            title: "Seeded Yoga class",
            description: "seeded",
            recurringEventId: Buffer.from("seeded-yoga-class").toString("base64"),
            startTime: dayjs().subtract(4, "day").toDate(),
            endTime: dayjs().subtract(4, "day").add(30, "minutes").toDate(),
            status: BookingStatus.ACCEPTED,
          },
          {
            uid: uuid(),
            title: "Seeded Yoga class",
            description: "seeded",
            recurringEventId: Buffer.from("seeded-yoga-class").toString("base64"),
            startTime: dayjs().subtract(4, "day").add(1, "week").toDate(),
            endTime: dayjs().subtract(4, "day").add(1, "week").add(30, "minutes").toDate(),
            status: BookingStatus.ACCEPTED,
          },
          {
            uid: uuid(),
            title: "Seeded Yoga class",
            description: "seeded",
            recurringEventId: Buffer.from("seeded-yoga-class").toString("base64"),
            startTime: dayjs().subtract(4, "day").add(2, "week").toDate(),
            endTime: dayjs().subtract(4, "day").add(2, "week").add(30, "minutes").toDate(),
            status: BookingStatus.ACCEPTED,
          },
          {
            uid: uuid(),
            title: "Seeded Yoga class",
            description: "seeded",
            recurringEventId: Buffer.from("seeded-yoga-class").toString("base64"),
            startTime: dayjs().subtract(4, "day").add(3, "week").toDate(),
            endTime: dayjs().subtract(4, "day").add(3, "week").add(30, "minutes").toDate(),
            status: BookingStatus.ACCEPTED,
          },
        ],
      },
      {
        title: "Tennis class",
        slug: "tennis-class",
        length: 60,
        recurringEvent: { freq: 2, count: 10, interval: 2 },
        requiresConfirmation: true,
        _bookings: [
          {
            uid: uuid(),
            title: "Tennis class",
            recurringEventId: Buffer.from("tennis-class").toString("base64"),
            startTime: dayjs().add(2, "day").toDate(),
            endTime: dayjs().add(2, "day").add(60, "minutes").toDate(),
            status: BookingStatus.PENDING,
          },
          {
            uid: uuid(),
            title: "Tennis class",
            recurringEventId: Buffer.from("tennis-class").toString("base64"),
            startTime: dayjs().add(2, "day").add(2, "week").toDate(),
            endTime: dayjs().add(2, "day").add(2, "week").add(60, "minutes").toDate(),
            status: BookingStatus.PENDING,
          },
          {
            uid: uuid(),
            title: "Tennis class",
            recurringEventId: Buffer.from("tennis-class").toString("base64"),
            startTime: dayjs().add(2, "day").add(4, "week").toDate(),
            endTime: dayjs().add(2, "day").add(4, "week").add(60, "minutes").toDate(),
            status: BookingStatus.PENDING,
          },
          {
            uid: uuid(),
            title: "Tennis class",
            recurringEventId: Buffer.from("tennis-class").toString("base64"),
            startTime: dayjs().add(2, "day").add(8, "week").toDate(),
            endTime: dayjs().add(2, "day").add(8, "week").add(60, "minutes").toDate(),
            status: BookingStatus.PENDING,
          },
          {
            uid: uuid(),
            title: "Tennis class",
            recurringEventId: Buffer.from("tennis-class").toString("base64"),
            startTime: dayjs().add(2, "day").add(10, "week").toDate(),
            endTime: dayjs().add(2, "day").add(10, "week").add(60, "minutes").toDate(),
            status: BookingStatus.PENDING,
          },
        ],
      },
    ],
  });

  await createUserAndEventType({
    user: {
      email: "trial@example.com",
      password: "trial",
      username: "trial",
      name: "Trial Example",
    },
    eventTypes: [
      {
        title: "30min",
        slug: "30min",
        length: 30,
      },
      {
        title: "60min",
        slug: "60min",
        length: 60,
      },
    ],
  });

  await createUserAndEventType({
    user: {
      email: "free@example.com",
      password: "free",
      username: "free",
      name: "Free Example",
    },
    eventTypes: [
      {
        title: "30min",
        slug: "30min",
        length: 30,
      },
      {
        title: "60min",
        slug: "60min",
        length: 30,
      },
    ],
  });

  await createUserAndEventType({
    user: {
      email: "usa@example.com",
      password: "usa",
      username: "usa",
      name: "USA Timezone Example",
      timeZone: "America/Phoenix",
    },
    eventTypes: [
      {
        title: "30min",
        slug: "30min",
        length: 30,
      },
    ],
  });

  const freeUserTeam = await createUserAndEventType({
    user: {
      email: "teamfree@example.com",
      password: "teamfree",
      username: "teamfree",
      name: "Team Free Example",
    },
  });

  const proUserTeam = await createUserAndEventType({
    user: {
      email: "teampro@example.com",
      password: "teampro",
      username: "teampro",
      name: "Team Pro Example",
    },
  });

  await createUserAndEventType({
    user: {
      email: "admin@example.com",
      /** To comply with admin password requirements  */
      password: "ADMINadmin2022!",
      username: "admin",
      name: "Admin Example",
      role: "ADMIN",
    },
  });

  const pro2UserTeam = await createUserAndEventType({
    user: {
      email: "teampro2@example.com",
      password: "teampro2",
      username: "teampro2",
      name: "Team Pro Example 2",
    },
  });

  const pro3UserTeam = await createUserAndEventType({
    user: {
      email: "teampro3@example.com",
      password: "teampro3",
      username: "teampro3",
      name: "Team Pro Example 3",
    },
  });

  const pro4UserTeam = await createUserAndEventType({
    user: {
      email: "teampro4@example.com",
      password: "teampro4",
      username: "teampro4",
      name: "Team Pro Example 4",
    },
  });

  if (!!(process.env.E2E_TEST_CALCOM_QA_EMAIL && process.env.E2E_TEST_CALCOM_QA_PASSWORD)) {
    await createUserAndEventType({
      user: {
        email: process.env.E2E_TEST_CALCOM_QA_EMAIL || "qa@example.com",
        password: process.env.E2E_TEST_CALCOM_QA_PASSWORD || "qa",
        username: "qa",
        name: "QA Example",
      },
      eventTypes: [
        {
          title: "15min",
          slug: "15min",
          length: 15,
        },
      ],
      credentials: [
        !!process.env.E2E_TEST_CALCOM_QA_GCAL_CREDENTIALS
          ? {
              type: "google_calendar",
              key: JSON.parse(process.env.E2E_TEST_CALCOM_QA_GCAL_CREDENTIALS) as Prisma.JsonObject,
              appId: "google-calendar",
            }
          : null,
      ],
    });
  }

  await createTeamAndAddUsers(
    {
      name: "Seeded Team",
      slug: "seeded-team",
      eventTypes: {
        createMany: {
          data: [
            {
              title: "Collective Seeded Team Event",
              slug: "collective-seeded-team-event",
              length: 15,
              schedulingType: "COLLECTIVE",
            },
            {
              title: "Round Robin Seeded Team Event",
              slug: "round-robin-seeded-team-event",
              length: 15,
              schedulingType: "ROUND_ROBIN",
            },
          ],
        },
      },
      createdAt: new Date(),
    },
    [
      {
        id: proUserTeam.id,
        username: proUserTeam.name || "Unknown",
      },
      {
        id: freeUserTeam.id,
        username: freeUserTeam.name || "Unknown",
      },
      {
        id: pro2UserTeam.id,
        username: pro2UserTeam.name || "Unknown",
        role: "MEMBER",
      },
      {
        id: pro3UserTeam.id,
        username: pro3UserTeam.name || "Unknown",
      },
      {
        id: pro4UserTeam.id,
        username: pro4UserTeam.name || "Unknown",
      },
    ]
  );
}

main()
  .then(() => mainAppStore())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
