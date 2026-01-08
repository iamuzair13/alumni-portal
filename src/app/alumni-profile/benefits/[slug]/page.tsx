import { notFound } from "next/navigation";
import AppHeader from "@/layout/AppHeader";
import React from "react";
import BackButton from "@/components/ui/BackButton";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/dbconnect";
import { isViewerUser } from "@/lib/alumniProfile";

const benefitsData: Record<string, { title: string; description: string; content: string; icon: React.ReactElement }> = {
  "academic-benefits": {
    title: "Alumni Fee Discounts & Scholarships",
    description: "Avail special tuition and admission discounts offered to UOL alumni.",
    content: `
      <div class="mb-8">
        <h3 class="text-2xl font-bold text-gray-900 mb-3">Academic: Fee Discounts & Scholarships</h3>
        <p class="text-gray-700 text-lg leading-relaxed mb-6">As a valued UOL alumnus, you are eligible for academic scholarships and fee discounts on all programs and courses. These benefits support your continued learning and professional growth while rewarding your connection with UOL.</p>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div class="lg:col-span-2">
          <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div class="bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-4">
              <h4 class="text-xl font-bold text-white">Available Scholarships & Discounts</h4>
            </div>
            <div class="p-6">
              <div class="overflow-x-auto">
                <table class="min-w-full border-collapse">
                  <thead>
                    <tr class="bg-gray-50 border-b-2 border-gray-200">
                      <th class="px-4 py-3 text-left font-semibold text-gray-800">Benefit Category</th>
                      <th class="px-4 py-3 text-left font-semibold text-gray-800">Eligibility</th>
                      <th class="px-4 py-3 text-left font-semibold text-gray-800">Coverage / Percentage</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-4 py-4 font-semibold text-gray-900">Kinship Scholarship Discounts</td>
                      <td class="px-4 py-4 text-gray-700">Alumni immediate family members and siblings</td>
                      <td class="px-4 py-4 text-gray-700">15% discount on tuition fee (one scholarship at a time, in case the member is eligible for other scholarships e.g., Merit, High Achiever etc.)</td>
                    </tr>
                    <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                      <td class="px-4 py-4 font-semibold text-gray-900">Masters or PhD Alumni Scholarship</td>
                      <td class="px-4 py-4 text-gray-700">UOL Alumni (pursuing second degree at UOL)</td>
                      <td class="px-4 py-4 text-gray-700">
                        <ul class="list-disc list-inside space-y-1 text-sm">
                          <li>Admission Fee: 75% discount</li>
                          <li>Tuition Fee: 50% discount for Masters, 25% discount for PhD</li>
                          <li>Additional 5% tuition discount for gold medallists</li>
                        </ul>
                      </td>
                    </tr>
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-4 py-4 font-semibold text-gray-900">Masters Scholarships via UOL International Collaborations</td>
                      <td class="px-4 py-4 text-gray-700">UOL Alumni</td>
                      <td class="px-4 py-4 text-gray-700">
                        <p class="mb-2 text-sm">Same discount % & services, as offered to UOL students pursuing international graduate programs through UOL international academic partners.</p>
                        <p class="font-semibold mt-2 mb-1 text-sm">Current Partnerships:</p>
                        <ul class="list-disc list-inside space-y-1 text-sm">
                          <li>University of Plymouth, UK</li>
                          <li>Western Scotland University</li>
                          <li>California State University Northridge, USA</li>
                        </ul>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="space-y-6">
          <div class="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-sm">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 class="text-lg font-bold text-gray-900">Apply for Scholarships</h4>
            </div>
            <p class="text-gray-700 mb-4 text-sm leading-relaxed">
              To avail any of these scholarships or discounts (Kinship Scholarship, MS and PhD Discounts, Masters Scholarships via UOL International Collaborations), please fill the application form below.
            </p>
            <a href="/alumni-profile/scholarship-application" class="inline-flex items-center justify-center w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Apply Now
            </a>
          </div>
        </div>
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
    description: "Avail comprehensive health insurance and wellness programs as an alumni member.",
    content: `
      <div class="mb-8">
        <h3 class="text-2xl font-bold text-gray-900 mb-3">Healthcare Benefits</h3>
        <p class="text-gray-700 text-lg leading-relaxed mb-6">We care about your health and wellbeing. Our alumni healthcare benefits provide comprehensive medical consultation and diagnostic services at University of Lahore Hospital and Sehat Medical Complexes.</p>
      </div>
      
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div class="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-4">
          <h4 class="text-xl font-bold text-white">Healthcare Services</h4>
        </div>
        <div class="p-6">
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse">
              <thead>
                <tr class="bg-gray-50 border-b-2 border-gray-200">
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Benefit Category</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Eligibility</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Coverage / Percentage</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Medical Consultation, Diagnostic Services at University of Lahore Hospital (ULH)</td>
                  <td class="px-4 py-4 text-gray-700" rowspan="2">Alumni and family members (Spouse, Children)</td>
                  <td class="px-4 py-4 text-gray-700" rowspan="2">Same discount % & services, as offered to UOL students</td>
                </tr>
                <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Medical Consultation, Diagnostic Services at all UOL SMCs (Sehat Medical Complexes)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-emerald-700" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    ),
  },
  "identity-inclusion": {
    title: "Identity & Inclusion",
    description: "Avail UOL library access (on-campus & online) and a permanent UOL alumni email.",
    content: `
      <div class="mb-8">
        <h3 class="text-2xl font-bold text-gray-900 mb-3">Identity & Inclusion: UOL Facilities Access & Memberships</h3>
        <p class="text-gray-700 text-lg leading-relaxed mb-6">As a valued member of our alumni community, you have access to exclusive facilities and memberships designed to support your continued connection with the University of Lahore.</p>
      </div>
      
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div class="bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-4">
          <h4 class="text-xl font-bold text-white">Alumni Facilities & Services</h4>
        </div>
        <div class="p-6">
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse">
              <thead>
                <tr class="bg-gray-50 border-b-2 border-gray-200">
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Benefit Category</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Coverage / Percentage for Alumni</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                
               
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
      <div class="mb-8">
        <h3 class="text-2xl font-bold text-gray-900 mb-3">Campus Facilities and Memberships</h3>
        <p class="text-gray-700 text-lg leading-relaxed mb-6">Stay connected to campus life with exclusive access to our state-of-the-art facilities and amenities, including gym, swimming pool, cricket club, and restaurant discounts.</p>
      </div>
      
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div class="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4">
          <h4 class="text-xl font-bold text-white">Campus Facilities & Memberships</h4>
        </div>
        <div class="p-6">
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse">
              <thead>
                <tr class="bg-gray-50 border-b-2 border-gray-200">
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Benefit Category</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Coverage / Percentage for Alumni</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">UOL Gym Membership</td>
                  <td class="px-4 py-4 text-gray-700">
                    <ul class="list-disc list-inside space-y-1 text-sm">
                      <li>Same % discount as offered to UOL Students</li>
                      <li>Free registration for select competitions</li>
                    </ul>
                  </td>
                  <td class="px-4 py-4">
                    <a href="/alumni-profile/gym-membership" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Apply
                    </a>
                  </td>
                </tr>
                <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">UOL Swimming Pool Membership</td>
                  <td class="px-4 py-4 text-gray-700">
                    <ul class="list-disc list-inside space-y-1 text-sm">
                      <li>Same % discount as offered to UOL Students</li>
                      <li>Free registration for select competitions</li>
                    </ul>
                  </td>
                  <td class="px-4 py-4">
                    <a href="/alumni-profile/swimming-pool-membership" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Apply
                    </a>
                  </td>
                </tr>
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">UOL Qalandars Cricket Club Membership</td>
                  <td class="px-4 py-4 text-gray-700">
                    <ul class="list-disc list-inside space-y-1 text-sm">
                      <li>Same % discount as offered to UOL Students</li>
                      <li>Free registration for select tournaments</li>
                    </ul>
                  </td>
                  <td class="px-4 py-4"></td>
                </tr>
                <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Discounts at UOL Restaurants (Poet)</td>
                  <td class="px-4 py-4 text-gray-700">Same % discount as offered to UOL Students</td>
                  <td class="px-4 py-4"></td>
                </tr>
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Free 3 Membership coupons to Alumni per month for Gym & Pool</td>
                  <td class="px-4 py-4 text-gray-700">Monthly draw run through portal</td>
                  <td class="px-4 py-4"></td>
                </tr>
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Access to UOL Library Resources</td>
                  <td class="px-4 py-4 text-gray-700">
                    <ul class="list-disc list-inside space-y-2">
                      <li>Free on-campus access</li>
                      <li>Free on-line access (digital library)</li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-blue-700" viewBox="0 0 24 24">
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
      </svg>
    ),
  },
  "merchant-promotions": {
    title: "Merchant and Business Promotions",
    description: "Exclusive partner discounts and offers available for alumni with the Alumni Card.",
    content: `
      <div class="mb-8">
        <h3 class="text-2xl font-bold text-gray-900 mb-3">Merchant Discounts & Alumni Businesses Promotion</h3>
        <p class="text-gray-700 text-lg leading-relaxed mb-6">Enjoy exclusive discounts from partnered merchants and get support for launching your alumni business or start-up through UOL Alumni platforms.</p>
      </div>
      
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div class="bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-4">
          <h4 class="text-xl font-bold text-white">Merchant & Business Benefits</h4>
        </div>
        <div class="p-6">
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse">
              <thead>
                <tr class="bg-gray-50 border-b-2 border-gray-200">
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Benefit Category</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Coverage / Percentage for Alumni</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Discounts at Partnered Merchants (Restaurants, Shopping Brands etc.)</td>
                  <td class="px-4 py-4 text-gray-700">
                    <ul class="list-disc list-inside space-y-2">
                      <li>Same discount % & services, as offered to UOL students.</li>
                    </ul>
                  </td>
                </tr>
                <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Alumni Start-up Launch @ UOL</td>
                  <td class="px-4 py-4 text-gray-700">Launch or promotion of UOL Alumni businesses / start-ups through UOL Alumni Social Media and extend their offers to UOL community</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-orange-700" viewBox="0 0 24 24">
        <path d="M7 18c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM1 2v2h2l3.6 7.59-1.35 2.45c-.15.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
      </svg>
    ),
  },
  "career-mentorship": {
    title: "Career and Mentorship",
    description: " Avail exclusive career and professional development opportunities.",
    content: `
      <div class="mb-8">
        <h3 class="text-2xl font-bold text-gray-900 mb-3">Career: Mentorship, Employment, Career Progression & Recognition</h3>
        <p class="text-gray-700 text-lg leading-relaxed mb-6">Advance your career with our comprehensive professional development and mentorship programs designed to support your growth at every stage, from mentorship and job opportunities to start-up support.</p>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div class="lg:col-span-2">
          <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div class="bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-4">
              <h4 class="text-xl font-bold text-white">Career Development Programs</h4>
            </div>
            <div class="p-6">
              <div class="overflow-x-auto">
                <table class="min-w-full border-collapse">
                  <thead>
                    <tr class="bg-gray-50 border-b-2 border-gray-200">
                      <th class="px-4 py-3 text-left font-semibold text-gray-800">Benefit</th>
                      <th class="px-4 py-3 text-left font-semibold text-gray-800">Coverage / Channel</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-4 py-4 font-semibold text-gray-900">Mentorship and Coaching Programs</td>
                      <td class="px-4 py-4 text-gray-700">Free one on one mentorship & coaching session (through prior registration) for Alumni, led by industry COs (CEO, COO, etc.)</td>
                    </tr>
                    <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                      <td class="px-4 py-4 font-semibold text-gray-900">Job Postings and Career Opportunities</td>
                      <td class="px-4 py-4 text-gray-700">Access to jobs offered by UOL as well as other employers, as advertised on UOL Alumni website, UOL Career Portal, official emails, social media platforms.</td>
                    </tr>
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-4 py-4 font-semibold text-gray-900">Career Counselling & Job Placement Support</td>
                      <td class="px-4 py-4 text-gray-700">One-on-one career counselling and placement support through UOL Alumni office representative </td>
                    </tr>
                    <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                      <td class="px-4 py-4 font-semibold text-gray-900">Invitation to Recruitment Drives</td>
                      <td class="px-4 py-4 text-gray-700">Alumni participation in UOL-organized recruitment drives, career expos, both as job seeker or employer (through prior registration)</td>
                    </tr>
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-4 py-4 font-semibold text-gray-900">Participation in Seminars, Workshops, and Conferences</td>
                      <td class="px-4 py-4 text-gray-700">Invitation & participation (through prior registration) in seminars, conferences, symposia, bootcamps, and training workshops organized by UOL or its partners</td>
                    </tr>
                    <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                      <td class="px-4 py-4 font-semibold text-gray-900">Start-ups support through UOL Innovation Hub (iHub)</td>
                      <td class="px-4 py-4 text-gray-700">Support to Alumni on their Start-up incubation or accelerator programs (through iHub), entrepreneurship bootcamps, joint research & innovation challenges.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        
        <div class="space-y-6">
          <div class="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-6 shadow-sm">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h4 class="text-lg font-bold text-gray-900">Upskill & Reskill Courses</h4>
            </div>
            <p class="text-gray-700 mb-4 text-sm leading-relaxed">
              As a valued UOL alumnus, you can take advantage of our exclusive Upskill & Reskill courses designed to boost your professional knowledge and career growth. Select your preferred course offered by department below.
            </p>
            <div class="bg-white rounded-lg p-4 mb-4 border border-purple-200">
              <p class="text-xs font-semibold text-gray-600 mb-2">DISCOUNT OFFERED:</p>
              <p class="text-sm text-gray-800 font-medium">Up to 15% discount (on top of regular offered discounts) on courses, certifications, related to skill and professional development.</p>
            </div>
            <div class="bg-white rounded-lg p-4 mb-4 border border-purple-200">
              <p class="text-xs font-semibold text-gray-600 mb-2">CURRENT PROGRAMS:</p>
              <ul class="text-sm text-gray-800 space-y-1">
                <li class="flex items-start gap-2">
                  <span class="text-purple-600 mt-1">•</span>
                  <span>IT programs through Flumni (UOL's skill development platform)</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-purple-600 mt-1">•</span>
                  <span>Language Courses (Academy of Languages)</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-purple-600 mt-1">•</span>
                  <span>Skill Development Programs offered by various UOL Faculties & Departments</span>
                </li>
              </ul>
            </div>
            <a href="/alumni-profile/upskill-application" class="inline-flex items-center justify-center w-full px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Apply Now
            </a>
          </div>
        </div>
      </div>
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
      <div class="mb-8">
        <h3 class="text-2xl font-bold text-gray-900 mb-3">Networking: Chapters & Engagement Events</h3>
        <p class="text-gray-700 text-lg leading-relaxed mb-6">Stay connected with fellow alumni through our global network of chapters, special interest groups, advisory roles, and exciting engagement events.</p>
      </div>
      
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div class="bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-4">
          <h4 class="text-xl font-bold text-white">Chapters & Networking Opportunities</h4>
        </div>
        <div class="p-6">
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse">
              <thead>
                <tr class="bg-gray-50 border-b-2 border-gray-200">
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Benefit</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Coverage / Channel for Alumni</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Chapter* Membership and Ambassadorship</td>
                  <td class="px-4 py-4 text-gray-700">Membership of Local, Regional, and International Alumni chapters, promoting Alumni community engagement, networking, and various professional & social interaction events.</td>
                </tr>
                <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Alumni Associations</td>
                  <td class="px-4 py-4 text-gray-700">Membership of various UOL Alumni Associations, focused on a specific subject or initiative, as announced on Alumni website</td>
                </tr>
                <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Alumni Networking Events</td>
                  <td class="px-4 py-4 text-gray-700">Participation in regular meet-ups (area-wise, faculty-wise) conducted by UOL Alumni Office as per the schedule announced at Alumni website.</td>
                </tr>
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Alumni Talks & Podcasts</td>
                  <td class="px-4 py-4 text-gray-700">
                    <ul class="list-disc list-inside space-y-2">
                      <li>Participation as mentor or guest speaker to deliver a talk to UOL students</li>
                      <li>Participate in Alumni Podcast series to promote UOL Alumni on various platforms</li>
                    </ul>
                  </td>
                </tr>
                <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Participation in UOL Mega Events</td>
                  <td class="px-4 py-4 text-gray-700">
                    Participation in UOL Organized Mega Events (through prior registration) e.g.:
                    <ul class="list-disc list-inside mt-2 space-y-2">
                      <li>Alumni Annual Homecoming</li>
                      <li>UOL Annual Graduation Ceremony</li>
                      <li>UOL Annual Sports Festivals</li>
                      <li>UOL Organized International Conferences</li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-lg">
        <p class="text-sm text-gray-700 italic"><span class="font-semibold">*</span> Alumni Chapter is a local, regional or international professional network of UOL alumni established under approval of the UOL Alumni Office</p>
      </div>
    `,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-rose-700" viewBox="0 0 24 24">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
    ),
  },
  "recognition": {
    title: "Recognition",
    description: " Avail opportunities to be honored for achievements via awards and spotlights.",
    content: `
      <div class="mb-8">
        <h3 class="text-2xl font-bold text-gray-900 mb-3">Recognition Programs</h3>
        <p class="text-gray-700 text-lg leading-relaxed mb-6">We celebrate the remarkable achievements and contributions of our alumni community through various recognition programs, awards, and spotlight features.</p>
      </div>
      
      <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div class="bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-4">
          <h4 class="text-xl font-bold text-white">Recognition & Awards</h4>
        </div>
        <div class="p-6">
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse">
              <thead>
                <tr class="bg-gray-50 border-b-2 border-gray-200">
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Benefit</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-800">Coverage / Channel</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Awards for High Achievers (Gold, Silver, Bronze)</td>
                  <td class="px-4 py-4 text-gray-700">
                    <ul class="list-disc list-inside space-y-2">
                      <li>Participation in quarterly high achiever recognition competition for professional excellence, entrepreneurship, or public service, through Alumni website to earn various awards (criteria based).</li>
                      <li>The awards will be presented by the Board of Governance, and subsequently published on social media; campus displays etc.</li>
                    </ul>
                  </td>
                </tr>
                <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">Alumni Wall of Fame & Social Media Spotlight</td>
                  <td class="px-4 py-4 text-gray-700">
                    <ul class="list-disc list-inside space-y-2">
                      <li>Display of Alumni picture & profile on walls of fame at various location within UOL campuses as well as on online platforms</li>
                      <li>Highlighting Alumni success stories on UOL's website and social media.</li>
                    </ul>
                  </td>
                </tr>
                 <tr class="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td class="px-4 py-4 font-semibold text-gray-900">UOL Alumni Email</td>
                  <td class="px-4 py-4 text-gray-700">Permanent email address @alumni.uol.edu.pk</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
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

  // Get SAP ID for the scholarship application link
  let sapId = "";
  const session = await auth();
  const isViewer = isViewerUser(session?.user);
  
  try {
    const userSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
    const userEmail = session?.user?.email ? String(session.user.email) : undefined;

    if (userSapid) {
      sapId = userSapid;
    } else if (userEmail) {
      const rows = await sql/* sql */`
        SELECT sapid FROM public.tbl_alumni 
        WHERE personalemail = ${userEmail} OR officialemail = ${userEmail} OR universityemail = ${userEmail}
        ORDER BY alumniid DESC LIMIT 1`;
      if (rows[0]?.sapid) {
        sapId = String(rows[0].sapid);
      }
    }
  } catch {
    // If we can't get SAP ID, link will work without it (page will fetch it)
  }

  // Inject SAP ID into the content if it's the academic-benefits, career-mentorship, or campus-facilities page
  let content = benefit.content;
  if (slug === "academic-benefits" && sapId) {
    content = content.replace(
      'href="/alumni-profile/scholarship-application"',
      `href="/alumni-profile/scholarship-application?sapid=${encodeURIComponent(sapId)}"`
    );
  }
  if (slug === "career-mentorship" && sapId) {
    content = content.replace(
      'href="/alumni-profile/upskill-application"',
      `href="/alumni-profile/upskill-application?sapid=${encodeURIComponent(sapId)}"`
    );
  }
  if (slug === "campus-facilities" && sapId) {
    content = content.replace(
      'href="/alumni-profile/gym-membership"',
      `href="/alumni-profile/gym-membership?sapid=${encodeURIComponent(sapId)}"`
    );
    content = content.replace(
      'href="/alumni-profile/swimming-pool-membership"',
      `href="/alumni-profile/swimming-pool-membership?sapid=${encodeURIComponent(sapId)}"`
    );
  }

  // Remove Apply links for viewers
  if (isViewer) {
    // Remove Apply buttons/links from content using regex
    content = content.replace(/<a[^>]*href="[^"]*alumni-profile\/(scholarship-application|gym-membership|swimming-pool-membership|mentorship|upskill-application)"[^>]*>[\s\S]*?<\/a>/gi, '');
    // Remove the entire "Apply for Scholarships" section for academic-benefits
    if (slug === "academic-benefits") {
      content = content.replace(/<div class="bg-gradient-to-br from-blue-50 to-indigo-50[^>]*>[\s\S]*?Apply Now[\s\S]*?<\/a>[\s\S]*?<\/div>[\s\S]*?<\/div>/gi, '');
    }
    // Remove Apply buttons from campus-facilities table cells
    if (slug === "campus-facilities") {
      content = content.replace(/<td class="px-4 py-4">[\s\S]*?<a[^>]*href="[^"]*alumni-profile\/(gym-membership|swimming-pool-membership)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/td>/gi, '<td class="px-4 py-4"></td>');
    }
    // Remove Apply Now button from career-mentorship
    if (slug === "career-mentorship") {
      content = content.replace(/<a[^>]*href="[^"]*alumni-profile\/upskill-application"[^>]*>[\s\S]*?Apply Now[\s\S]*?<\/a>/gi, '');
    }
  }

  return (
    <>
      <div className="bg-slate-100 overflow-x-hidden">
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
                <BackButton />
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{benefit.title}</h2>
                  <p className="text-slate-600 mt-2">{benefit.description}</p>
                </div>
              </div>

              <div
                className="prose prose-slate max-w-none [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-4 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:mt-6 [&_h4]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:mb-4 [&_ul]:space-y-2"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

