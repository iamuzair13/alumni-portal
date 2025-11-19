import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/layout/AppHeader";
import React from "react";

const benefitsData: Record<string, { title: string; description: string; content: string; icon: React.ReactElement }> = {
  "academic-benefits": {
    title: "Fee Discounts & Scholarships",
    description: "Access to library resources, research databases, and academic support services.",
    content: `
      <h3 class="text-xl font-semibold mb-4">Academic: Fee Discounts & Scholarships</h3>
      <p class="mb-6">As a valued member of our alumni community, you have access to exclusive fee discounts and scholarship opportunities designed to support your continued education and professional development.</p>
      
      <div class="overflow-x-auto mb-6">
        <table class="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr class="bg-gray-100">
              <th class="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-800">Benefit Category</th>
              <th class="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-800">Eligibility</th>
              <th class="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-800">Coverage / Percentage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="border border-gray-300 px-4 py-3 font-medium text-gray-900">Kinship Scholarship Discounts</td>
              <td class="border border-gray-300 px-4 py-3 text-gray-700">Alumni immediate family members and siblings</td>
              <td class="border border-gray-300 px-4 py-3 text-gray-700">15% discount on tuition fee (one scholarship at a time, in case the member is eligible for other scholarships e.g., Merit, High Achiever etc.)</td>
            </tr>
            <tr class="bg-gray-50">
              <td class="border border-gray-300 px-4 py-3 font-medium text-gray-900">Masters or PhD Alumni Scholarship</td>
              <td class="border border-gray-300 px-4 py-3 text-gray-700">UOL Alumni (pursuing second degree at UOL)</td>
              <td class="border border-gray-300 px-4 py-3 text-gray-700">
                <ul class="list-disc list-inside space-y-1">
                  <li>Admission Fee: 75% discount</li>
                  <li>Tuition Fee: 50% discount for Masters, 25% discount for PhD</li>
                  <li>Additional 5% tuition discount for gold medallists</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td class="border border-gray-300 px-4 py-3 font-medium text-gray-900">Masters Scholarships via UOL International Collaborations</td>
              <td class="border border-gray-300 px-4 py-3 text-gray-700">UOL Alumni</td>
              <td class="border border-gray-300 px-4 py-3 text-gray-700">
                <p class="mb-2">Same discount % & services, as offered to UOL students pursuing international graduate programs through UOL international academic partners.</p>
                <p class="font-semibold mt-2 mb-1">Current Partnerships:</p>
                <ul class="list-disc list-inside space-y-1">
                  <li>University of Plymouth, UK</li>
                  <li>Western Scotland University</li>
                  <li>California State University Northridge, USA</li>
                </ul>
              </td>
            </tr>
            <tr class="bg-gray-50">
              <td class="border border-gray-300 px-4 py-3 font-medium text-gray-900">Upskill and Reskill Courses (on-prem and on-line)</td>
              <td class="border border-gray-300 px-4 py-3 text-gray-700">UOL Alumni</td>
              <td class="border border-gray-300 px-4 py-3 text-gray-700">
                <p class="mb-2">Up to 15% discount (on top of regular offered discounts) on courses, certifications, related to skill and professional development.</p>
                <p class="font-semibold mt-2 mb-1">Current Programs:</p>
                <ul class="list-disc list-inside space-y-1">
                  <li>IT programs through Flumni (UOL's skill development platform)</li>
                  <li>Language Courses (Academy of Languages)</li>
                  <li>Skill Development Programs offered by various UOL Faculties & Departments</li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-indigo-700" viewBox="0 0 24 24">
        <path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H3V6h18v12z"/>
        <path d="M7 8h10v2H7zm0 4h7v2H7z"/>
      </svg>
    ),
  },
  "healthcare-benefits": {
    title: "Healthcare Benefits",
    description: "Comprehensive health insurance and wellness programs for alumni members.",
    content: `
      <h3 class="text-xl font-semibold mb-4">Healthcare Benefits for Alumni</h3>
      <p class="mb-4">We care about your health and wellbeing. Our alumni healthcare benefits provide comprehensive coverage and wellness support to help you maintain a healthy lifestyle.</p>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Health Insurance</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Group health insurance plans with competitive rates</li>
        <li>Coverage for medical, dental, and vision care</li>
        <li>Family coverage options available</li>
        <li>Access to network of healthcare providers</li>
      </ul>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Wellness Programs</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Annual health screenings and check-ups</li>
        <li>Fitness and wellness workshops</li>
        <li>Mental health support and counseling services</li>
        <li>Preventive care programs</li>
      </ul>
    `,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-emerald-700" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    ),
  },
  "identity-inclusion": {
    title: "Identity & Inclusion",
    description: "Foster a sense of belonging and celebrate diversity within our alumni community.",
    content: `
      <h3 class="text-xl font-semibold mb-4">Identity & Inclusion</h3>
      <p class="mb-4">Our alumni community is built on the foundation of diversity, inclusion, and mutual respect. We celebrate the unique identities and contributions of all our members.</p>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Inclusive Community</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Diverse representation in leadership and events</li>
        <li>Cultural celebration events and heritage months</li>
        <li>Support for underrepresented groups</li>
        <li>Inclusive policies and practices</li>
      </ul>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Affinity Groups</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Connect with alumni who share similar backgrounds</li>
        <li>Professional networking within affinity groups</li>
        <li>Mentorship opportunities</li>
        <li>Community support and resources</li>
      </ul>
    `,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-purple-700" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
      </svg>
    ),
  },
  "campus-facilities": {
    title: "Campus Facilities and Memberships",
    description: "Enjoy access to gym, sports facilities, and exclusive campus amenities.",
    content: `
      <h3 class="text-xl font-semibold mb-4">Campus Facilities and Memberships</h3>
      <p class="mb-4">Stay connected to campus life with exclusive access to our state-of-the-art facilities and amenities.</p>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Fitness & Recreation</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Gym and fitness center access</li>
        <li>Swimming pool and sports facilities</li>
        <li>Recreational activities and programs</li>
        <li>Personal training services</li>
      </ul>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Campus Amenities</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Parking privileges</li>
        <li>Dining hall access with alumni discounts</li>
        <li>Event space rentals</li>
        <li>Guest accommodation options</li>
      </ul>
    `,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-blue-700" viewBox="0 0 24 24">
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
      </svg>
    ),
  },
  "merchant-promotions": {
    title: "Merchant and Business Promotions",
    description: "Exclusive discounts and special offers from partner businesses and merchants.",
    content: `
      <h3 class="text-xl font-semibold mb-4">Merchant and Business Promotions</h3>
      <p class="mb-4">Enjoy exclusive discounts and special offers from our network of partner businesses and merchants.</p>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Partner Discounts</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Retail store discounts and promotions</li>
        <li>Restaurant and dining specials</li>
        <li>Travel and hotel booking discounts</li>
        <li>Technology and software deals</li>
      </ul>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Business Services</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Professional services at discounted rates</li>
        <li>Business consulting and advisory services</li>
        <li>Marketing and branding support</li>
        <li>Networking opportunities with partner businesses</li>
      </ul>
    `,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-orange-700" viewBox="0 0 24 24">
        <path d="M7 18c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM1 2v2h2l3.6 7.59-1.35 2.45c-.15.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
      </svg>
    ),
  },
  "career-mentorship": {
    title: "Career and Mentorship",
    description: "Professional development opportunities and mentorship programs for career growth.",
    content: `
      <h3 class="text-xl font-semibold mb-4">Career and Mentorship</h3>
      <p class="mb-4">Advance your career with our comprehensive professional development and mentorship programs designed to support your growth at every stage.</p>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Career Services</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Career counseling and guidance</li>
        <li>Resume review and interview preparation</li>
        <li>Job placement assistance</li>
        <li>Career transition support</li>
      </ul>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Mentorship Programs</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>One-on-one mentorship matching</li>
        <li>Industry-specific mentorship opportunities</li>
        <li>Peer-to-peer learning networks</li>
        <li>Professional development workshops</li>
      </ul>
    `,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-teal-700" viewBox="0 0 24 24">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
    ),
  },
  "chapters-events": {
    title: "Chapters & Engagement Events",
    description: "Connect with local chapters and participate in networking events worldwide.",
    content: `
      <h3 class="text-xl font-semibold mb-4">Chapters & Engagement Events</h3>
      <p class="mb-4">Stay connected with fellow alumni through our global network of chapters and exciting engagement events.</p>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Local Chapters</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Join or start a local alumni chapter</li>
        <li>Regional networking events and meetups</li>
        <li>Chapter leadership opportunities</li>
        <li>Community service initiatives</li>
      </ul>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Global Events</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Annual alumni reunions and homecoming</li>
        <li>Professional networking conferences</li>
        <li>Cultural and social events</li>
        <li>Virtual events and webinars</li>
      </ul>
    `,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-rose-700" viewBox="0 0 24 24">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
    ),
  },
  "recognition": {
    title: "Recognition",
    description: "Honor outstanding achievements and contributions of our distinguished alumni.",
    content: `
      <h3 class="text-xl font-semibold mb-4">Recognition</h3>
      <p class="mb-4">We celebrate the remarkable achievements and contributions of our alumni community through various recognition programs and awards.</p>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Awards & Honors</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Distinguished Alumni Awards</li>
        <li>Outstanding Achievement Recognition</li>
        <li>Young Alumni Excellence Awards</li>
        <li>Community Service Honors</li>
      </ul>
      
      <h4 class="text-lg font-semibold mt-6 mb-3">Spotlight Features</h4>
      <ul class="list-disc list-inside mb-4 space-y-2">
        <li>Alumni success stories and profiles</li>
        <li>Featured alumni in newsletters and publications</li>
        <li>Social media recognition</li>
        <li>Hall of Fame inductions</li>
      </ul>
    `,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-amber-700" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
  },
};

export default async function BenefitDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const benefit = benefitsData[slug];

  if (!benefit) {
    notFound();
  }

  return (
    <>
      <div className="bg-slate-200 overflow-x-hidden">
        <div className="border bg-white relative z-50">
          <AppHeader />
        </div>
        <div className="min-w-screen">
          <div className="-mx-4 sm:-mx-6 lg:-mx-8">
            <div className="w-full bg-gradient-to-r from-green-700 to-green-400 text-white">
              <div className="max-w-screen-xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
                <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Alumni Benefits</h1>
              </div>
            </div>
          </div>

          <div className="min-w-screen mx-auto mt-16 px-4 sm:px-6 md:px-8 lg:px-10">
            <div className="bg-white rounded-lg shadow-sm border p-6 sm:p-8 md:p-10">
              <div className="mb-6">
                <Link
                  href="/alumni-profile"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Profile
                </Link>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="flex-shrink-0">
                  {benefit.icon}
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{benefit.title}</h2>
                  <p className="text-slate-600 mt-2">{benefit.description}</p>
                </div>
              </div>

              <div
                className="prose prose-slate max-w-none [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-4 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:mt-6 [&_h4]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:mb-4 [&_ul]:space-y-2"
                dangerouslySetInnerHTML={{ __html: benefit.content }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

