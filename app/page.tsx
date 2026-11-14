import { Suspense } from "react";
import { DecorativeCircles } from "@/components/DecorativeCircles";
import { SiteHeader } from "@/components/SiteHeader";
import { Benefits } from "@/components/landing/Benefits";
import { BriefingForm } from "@/components/landing/BriefingForm";
import { Hero } from "@/components/landing/Hero";
import { LandingForm } from "@/components/landing/LandingForm";
import { SavedBriefingsList } from "@/components/landing/SavedBriefingsList";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="relative flex-1">
      <DecorativeCircles />
      <div className="relative mx-auto w-full max-w-[1120px] px-4 sm:px-6">
        <SiteHeader>
          <a href="#how-it-works" className="flex h-11 items-center rounded-full px-4 font-semibold text-ink hover:bg-surface">
            How it works
          </a>
        </SiteHeader>
        <main>
          <Hero />
          <div className="mx-auto mt-8 max-w-220">
            <Suspense fallback={<BriefingForm initialInput={null} notice={null} />}>
              <LandingForm searchParams={searchParams} />
            </Suspense>
          </div>
          <SavedBriefingsList />
          <Benefits />
        </main>
      </div>
    </div>
  );
}
