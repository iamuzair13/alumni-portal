"use client";



import React from "react";

import { BookOpen, Briefcase, Calendar, GraduationCap, Newspaper, Users } from "lucide-react";

import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";

import { AnalyticsCard } from "../AnalyticsCard";

import { ExpandDrawer } from "../ExpandDrawer";

import { MasonryGrid } from "../MasonryGrid";

import { ChaptersCardChart } from "../charts/ChaptersCardChart";

import { ActivitiesCardChart } from "../charts/ActivitiesCardChart";

import { ScholarshipsCardChart } from "../charts/ScholarshipsCardChart";

import { CareerCardChart } from "../charts/CareerCardChart";

import { MeetupsEventsCardChart } from "../charts/MeetupsEventsCardChart";

import { PublicationsCardChart } from "../charts/PublicationsCardChart";

import { staggerDelay } from "../animation/useStaggeredEntrance";

import { useExpandable } from "../hooks/useExpandable";

import { ccPerksSubsection, ccPerksSubsectionHeader, ccSectionLabel } from "../theme";

import {

  mapCareerBenefits,

  mapEngagementActivities,

  mapEngagementsChapters,

  mapMeetupsEvents,

  mapPublicationsSurveys,

} from "../data/mapPayloadToCards";

import { ChaptersExpandPanel } from "../panels/ChaptersExpandPanel";

import { ActivitiesExpandPanel } from "../panels/ActivitiesExpandPanel";

import { ScholarshipsExpandPanel } from "../panels/ScholarshipsExpandPanel";

import { JobsExpandPanel } from "../panels/JobsExpandPanel";

import { MeetupsEventsExpandPanel } from "../panels/MeetupsEventsExpandPanel";

import { PublicationsExpandPanel } from "../panels/PublicationsExpandPanel";



const CARD_IDS = {

  chapters: "engagements-chapters",

  scholarships: "engagements-scholarships",

  jobs: "engagements-jobs",

  meetups: "meetups-events",

  activities: "engagement-activities",

  publications: "publications-surveys",

} as const;



const WIDE_DRAWER_IDS = new Set<string>([

  CARD_IDS.chapters,

  CARD_IDS.scholarships,

  CARD_IDS.jobs,

  CARD_IDS.meetups,

  CARD_IDS.activities,

  CARD_IDS.publications,

]);



export function SectionEngagements({

  data,

  isLoading,

}: {

  data: ManagementDashboardPayload | undefined;

  isLoading: boolean;

}) {

  const { activeId, open, close } = useExpandable();

  const chapters = mapEngagementsChapters(data);

  const career = mapCareerBenefits(data);

  const meetups = mapMeetupsEvents(data);

  const activities = mapEngagementActivities(data);

  const publications = mapPublicationsSurveys(data);



  const drawers: Record<string, { title: string; content: React.ReactNode }> = {

    [CARD_IDS.chapters]: {

      title: "Chapters",

      content: <ChaptersExpandPanel data={data} isLoading={isLoading} />,

    },

    [CARD_IDS.scholarships]: {

      title: "Scholarships",

      content: <ScholarshipsExpandPanel data={data} isLoading={isLoading} />,

    },

    [CARD_IDS.jobs]: {

      title: "Jobs",

      content: <JobsExpandPanel data={data} isLoading={isLoading} />,

    },

    [CARD_IDS.meetups]: {

      title: "Meetups & Events",

      content: <MeetupsEventsExpandPanel data={data} isLoading={isLoading} />,

    },

    [CARD_IDS.activities]: {

      title: "Engagement Activities",

      content: <ActivitiesExpandPanel data={data} isLoading={isLoading} />,

    },

    [CARD_IDS.publications]: {

      title: "Publications & Surveys",

      content: <PublicationsExpandPanel data={data} isLoading={isLoading} />,

    },

  };



  const active = activeId ? drawers[activeId] : null;

  const activityTotal = activities.ytdTotal;

  const shortQuarter =

    career.quarterLabel.length > 14

      ? career.quarterLabel.replace(/\s\d{4}$/, "")

      : career.quarterLabel;

  const approvalPct =
    career.scholarshipsApplied > 0
      ? Math.round((career.scholarshipsApproved / career.scholarshipsApplied) * 100)
      : 0;


  const jobsSecondaryParts = [

    `${career.jobs.uol.toLocaleString()} UOL · ${career.jobs.other.toLocaleString()} other`,

    shortQuarter ? `(${shortQuarter})` : null,

  ].filter(Boolean);



  return (

    <>

      <section aria-label="Engagements" className={ccPerksSubsection}>

        <h3 className={`${ccPerksSubsectionHeader} ${ccSectionLabel}`}>Engagements</h3>

        <MasonryGrid columns="narrow" layout="uniform" className="gap-4">

          <AnalyticsCard

            id={CARD_IDS.chapters}

            title="Chapters"

            icon={Users}

            accent="violet"

            variant="premium"

            primaryValue={chapters.national + chapters.international}

            secondaryLabel=""

            masonrySize="sm"

            chartFill

            delay={staggerDelay(0, 0)}

            onExpand={open}

            chart={
              <ChaptersCardChart
                nationalCount={chapters.national}
                internationalCount={chapters.international}
                nationalMembers={chapters.nationalMembers}
                internationalMembers={chapters.internationalMembers}
              />
            }

          />

          <AnalyticsCard

            id={CARD_IDS.scholarships}

            title="Scholarships"

            icon={GraduationCap}

            accent="violet"

            variant="premium"

            primaryValue={career.scholarshipsApproved}

            secondaryLabel=""

            masonrySize="lg"

            chartFill

            delay={staggerDelay(1, 0)}

            emptyIdle={career.scholarshipsApproved === 0 && career.scholarshipsApplied === 0}

            onExpand={open}

            chart={
              <ScholarshipsCardChart
                rows={career.scholarshipRows}
                total={career.scholarshipsApproved}
              />
            }

          />

          <AnalyticsCard

            id={CARD_IDS.jobs}

            title="Jobs"

            icon={Briefcase}

            accent="violet"

            variant="premium"

            primaryValue={career.jobs.total}

            secondaryLabel={shortQuarter ? `${shortQuarter}` : ""}

            masonrySize="md"

            chartFill

            delay={staggerDelay(2, 0)}

            emptyIdle={career.jobs.total === 0}

            onExpand={open}

            chart={

              <CareerCardChart

                total={career.jobs.total}

                uol={career.jobs.uol}

                other={career.jobs.other}

              />

            }

          />

          <AnalyticsCard

            id={CARD_IDS.meetups}

            title="Meetups & Events"

            icon={Calendar}

            accent="violet"

            variant="premium"

            primaryValue={meetups.events.total + meetups.meetups.total}

            secondaryLabel={meetups.quarterLabel ? `${meetups.quarterLabel}` : ""}

            masonrySize="md"

            chartFill

            delay={staggerDelay(3, 0)}

            onExpand={open}

            chart={

              <MeetupsEventsCardChart

                events={meetups.events}

                meetups={meetups.meetups}

              />

            }

          />

          <AnalyticsCard

            id={CARD_IDS.activities}

            title="Engagement Activities"

            icon={BookOpen}

            accent="violet"

            variant="premium"

            primaryValue={activityTotal}

            secondaryLabel={activities.quarterLabel ? `${activities.quarterLabel}` : ""}

            masonrySize="md"

            chartFill

            delay={staggerDelay(4, 0)}

            emptyIdle

            onExpand={open}

            chart={

              <ActivitiesCardChart

                rows={activities.rows}

                ytdTotal={activities.ytdTotal}

                quarterTotal={activities.quarterTotal}

              />

            }

          />

          <AnalyticsCard

            id={CARD_IDS.publications}

            title="Publications & Newsletters"

            icon={Newspaper}

            accent="violet"

            variant="premium"

            primaryValue={publications.stories}

            secondaryLabel={publications.newsletters > 0 ? `${publications.newsletters} newsletter${publications.newsletters !== 1 ? "s" : ""} issued` : ""}

            masonrySize="md"

            chartFill

            delay={staggerDelay(5, 0)}

            onExpand={open}

            chart={

              <PublicationsCardChart

                storiesYtd={publications.storiesYtd}

                storiesQuarter={publications.storiesQuarter}

                newslettersYtd={publications.newslettersYtd}

                surveys={publications.surveys}

              />

            }

          />

        </MasonryGrid>

      </section>



      <ExpandDrawer

        open={!!active}

        title={active?.title ?? ""}

        onClose={close}

        accent="violet"

        maxWidthClass={activeId && WIDE_DRAWER_IDS.has(activeId) ? "max-w-5xl" : "max-w-3xl"}

      >

        {active?.content}

      </ExpandDrawer>

    </>

  );

}

