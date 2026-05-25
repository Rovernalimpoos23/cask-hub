'use client'
// src/app/(app)/customers/templates/page.tsx

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/ui'

// ── Data ──────────────────────────────────────────────────────────────────────

type MeetingEntry = string | { code: string; title: string; type: 'meeting' | 'email' | 'internal'; agenda?: string[] }

interface Phase {
  number: number
  label: string
  color: string
  bgColor: string
  borderColor: string
  note?: string
  meetings: MeetingEntry[]
  startIndex: number
}

const PHASES: Phase[] = [
  {
    number: 1,
    label: 'Pre-Construction Pre-Design',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    meetings: [
      {
        code: 'PR1m',
        title: 'Internal Sales to Pre-Con Pass-Off',
        type: 'meeting',
        agenda: [
          'Customer Introduction',
          'Topographic Survey and Plans',
          'Customer Avatar',
          'ADU Checklist',
          'Property Analysis',
          'NPS Survey Handout',
        ],
      },
      {
        code: 'PR2e',
        title: 'Initial Alignment Scheduling to Customer',
        type: 'email',
      },
      {
        code: 'PR3m',
        title: 'Initial Alignment Meeting Agenda',
        type: 'meeting',
        agenda: [
          'Purpose: Review project expectations, budget alignment, site limitations, communication flow',
          'Project Timeline: Design 2-3 months, Permitting 2-3 months, Construction 4-7 months',
          'Floor Plan & Design Ideas',
          'Interior Design & Layout',
          'Mechanical & Utility Options',
          'Exterior & Structural Features',
          'Scheduling & Coordination',
          'Customer Goal',
          'NPS Survey Handout',
        ],
      },
      {
        code: 'PR4e',
        title: 'Alignment Meeting Recap to Customer',
        type: 'email',
      },
      {
        code: 'PR5m',
        title: 'On Site Flag with Customer',
        type: 'meeting',
        agenda: [
          'Welcome & Introductions',
          'Project Footprint Walkthrough',
          'Utility Location Review',
          'Next Steps',
          'Q&A / Customer Feedback',
          'NPS Survey Handout',
        ],
      },
      {
        code: 'PR6e',
        title: 'Flag Meeting Recap to Customer',
        type: 'email',
      },
    ],
    startIndex: 1,
  },
  {
    number: 2,
    label: 'Pre-Construction Design',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    meetings: [
      { code: 'PD1m', title: '50% Floor Plan with Customer', type: 'meeting' },
      { code: 'PD2e', title: '50% Floorplan Meeting Recap to Customer', type: 'email' },
      { code: 'PD3e', title: '50% Budget Update to Customer', type: 'email' },
      { code: 'PD4m', title: '75% Floor Plan with Customer', type: 'meeting' },
      { code: 'PD5e', title: '75% Floorplan Meeting Recap to Customer', type: 'email' },
      { code: 'PD6e', title: '75% Budget Update to Customer', type: 'email' },
      { code: 'PD7e', title: '95% Drawing to Customer', type: 'email' },
      { code: 'PD8e', title: 'Permit Submission Confirmation', type: 'email' },
    ],
    startIndex: 7,
  },
  {
    number: 3,
    label: 'Pre-Construction Permit',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    note: 'This phase is fully automated — all items are email templates sent to the customer during the permitting process.',
    meetings: [
      { code: 'PP1e', title: '1st RFC to Customer', type: 'email' },
      { code: 'PP2e', title: '1st RFC to Customer', type: 'email' },
      { code: 'PP3e', title: '2nd RFC to Customer', type: 'email' },
      { code: 'PP4e', title: '2nd RFC to Customer', type: 'email' },
      { code: 'PP5e', title: 'Permit Approval', type: 'email' },
    ],
    startIndex: 14,
  },
  {
    number: 4,
    label: 'Pre-Construction Selections',
    color: '#16a34a',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    meetings: [
      { code: 'PS1e', title: 'Selections Kick-off to Customer', type: 'email' },
      { code: 'PS2m', title: 'In-Person 1st Selections with Customer', type: 'meeting' },
      { code: 'PS3e', title: 'Post 1st Selections Meeting to Customer', type: 'email' },
      { code: 'PS4m', title: 'In-Person 2nd Selections with Customer', type: 'meeting' },
      { code: 'PS5e', title: 'Post 2nd Selections Meeting to Customer', type: 'email' },
      { code: 'PS6m', title: 'In-Person 3rd Selections with Customer', type: 'meeting' },
      { code: 'PS7e', title: 'Post 3rd Selections Meeting to Customer', type: 'email' },
      { code: 'PS8m', title: 'In-Person 4th Selections with Customer', type: 'meeting' },
    ],
    startIndex: 22,
  },
  {
    number: 5,
    label: 'Pre-Construction Bid Management',
    color: '#c8311a',
    bgColor: '#fdf2f0',
    borderColor: '#f5c9c2',
    meetings: [
      { code: 'PB1e', title: 'Sewage and Water Inspection to Customer', type: 'email' },
      { code: 'PB2m', title: 'In-Person Sewage and Water Inspection', type: 'meeting' },
      { code: 'PB3e', title: 'Congratulations Project Out to Bid', type: 'email' },
      { code: 'PB4e', title: '95% Budget Update to Customer', type: 'email' },
      { code: 'PB5m', title: 'Contract Review with Customer', type: 'meeting' },
      { code: 'PB6e', title: 'Contract Approval to Customer', type: 'email' },
    ],
    startIndex: 30,
  },
  {
    number: 6,
    label: 'Construction Groundbreaking',
    color: '#0891b2',
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc',
    meetings: [
      { code: 'CG1m', title: 'Kickoff with Customer', type: 'meeting' },
      { code: 'CG2.a', title: 'Demo If Needed (Internal)', type: 'internal' },
      { code: 'CG2.b', title: 'Site Survey Layout (Internal)', type: 'internal' },
      { code: 'CG2e', title: 'Kickoff Meeting Recap to Customer', type: 'email' },
      { code: 'CG3.a', title: 'Internal Sub Meeting (Internal)', type: 'internal' },
      { code: 'CG3m', title: 'Foundation and Slab On Grade with Customer', type: 'meeting' },
      { code: 'CG4e', title: 'Foundation and Slab On Grade Meeting Recap', type: 'email' },
    ],
    startIndex: 36,
  },
  {
    number: 7,
    label: 'Construction Structure',
    color: '#6366f1',
    bgColor: '#eef2ff',
    borderColor: '#c7d2fe',
    meetings: [
      { code: 'CS1e', title: 'Structure Stage Expectations Recap to Customer', type: 'email' },
      { code: 'CS2m', title: 'Structure Complete Celebration with Customer', type: 'meeting' },
      { code: 'CS3e', title: 'Structure Complete Celebration Meeting Recap with Customer', type: 'email' },
    ],
    startIndex: 43,
  },
  {
    number: 8,
    label: 'Construction Rough In',
    color: '#ea580c',
    bgColor: '#fff7ed',
    borderColor: '#fed7aa',
    meetings: [
      { code: 'CR1.a', title: 'Internal Sub Meeting (Internal)', type: 'internal' },
      { code: 'CR1m', title: 'Rough In with Customer', type: 'meeting' },
      { code: 'CR2e', title: 'Release to Hang to Customer', type: 'email' },
    ],
    startIndex: 46,
  },
  {
    number: 9,
    label: 'Construction Finish',
    color: '#0d9488',
    bgColor: '#f0fdfa',
    borderColor: '#99f6e4',
    meetings: [
      { code: 'CF1.a', title: 'Internal Sub Meeting (Internal)', type: 'internal' },
      { code: 'CF1m', title: 'Finishes with Customer', type: 'meeting' },
      { code: 'CF2e', title: 'Finish Meeting Recap to Customer', type: 'email' },
    ],
    startIndex: 49,
  },
  {
    number: 10,
    label: 'Construction Closeout',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    meetings: [
      { code: 'CC1e', title: 'Close Out Steps to Customer', type: 'email' },
      { code: 'CC1e.1', title: 'Certificate of Occupancy to Customer', type: 'email' },
      { code: 'CC2m', title: 'Punchlist Walkthrough with Customer', type: 'meeting' },
      { code: 'CC3e', title: 'Punch List Walkthrough Meeting Recap to Customer', type: 'email' },
      { code: 'CC4m', title: 'Final Walkthrough with Customer', type: 'meeting' },
    ],
    startIndex: 52,
  },
]

const STATS = [
  { value: '56', label: 'Total Items' },
  { value: '18', label: 'Meetings (M)' },
  { value: '31', label: 'Email Templates (E)' },
  { value: '5', label: 'Internal Files (P)' },
  { value: '10', label: 'Phases' },
]

// ── Agenda modal data ─────────────────────────────────────────────────────────

interface AgendaItem {
  text: string
  sub?: string[]
}

interface AgendaSection {
  title?: string
  numbered?: boolean
  items: (string | AgendaItem)[]
}

interface AgendaContent {
  header: string
  subheader: string
  sections: AgendaSection[]
  nps?: boolean
}

const NPS_QUESTIONS = [
  'How happy are you on a scale of 1-10?',
  'How do you feel our communication has been?',
  'How is the pace of the construction journey going?',
  'What could we improve or what made your journey enjoyable?',
]

const AGENDAS: Record<string, AgendaContent> = {
  PR1m: {
    header: 'PR1m — Sales to Pre-Con Pass-Off',
    subheader: 'Phase 1: Pre-Construction Pre-Design · Meeting',
    sections: [
      {
        title: 'AGENDA',
        items: [
          'Customer Introduction',
          'Topographic Survey and Plans (If Applicable)',
          'Customer Avatar',
          'ADU Checklist',
          'Property Analysis',
        ],
      },
      {
        title: 'CUSTOMER INFO',
        items: [
          {
            text: 'Primary Contact:',
            sub: ['Phone:', 'Email:', 'Address:'],
          },
          "Owner's Estimated Budget:",
          'ADU Option:',
          'Topographic Survey:',
          'Funding for ADU Secured:',
          'Customer Preferred Method of Payment:',
          {
            text: 'Secondary Contact:',
            sub: ['Phone:', 'Email:', 'Address:'],
          },
        ],
      },
      {
        title: 'KEY SECTIONS & ATTACHMENTS',
        items: [
          'Topographic Survey & Plans',
          'Photos',
          'Avatar',
          'Build Your ADU Checklist',
        ],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — PRELIMINARY',
        items: [
          'Structure Type:',
          'Flood Zone:',
          'Historic:',
          'Challenge in Setbacks:',
          'Challenge in Parking Requirements:',
          'Exterior Wall Materials:',
          'Exterior Facade:',
          'Roofing Material:',
          'Construction Site Preparation:',
          'General Elevation',
          'Bathroom Amenity Choices:',
          'Shower Niche:',
        ],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — 50%–75% DRAWINGS',
        items: [
          'Ceiling Height:',
          'Ceiling Style:',
          'Roof Pitch:',
          'Laundry:',
          'Air Condition Handler:',
          'Downstairs Garage:',
          'Separate Electric Meter:',
          'Separate Water Meter:',
          'Gas in ADU:',
          'Solar Power:',
          'Generator:',
          'Tesla Charger:',
          'Driveway Options:',
          'ADU Parking Option:',
          'Outdoor Space:',
          'Garage Option:',
          'Foundation & Footers:',
        ],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — 95% DRAWINGS',
        items: [
          'Decking Material:',
          'Handrail Material',
        ],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — 95% DRAWINGS — APPLIANCES',
        items: [
          'Refrigerator:',
          'Dishwasher:',
          'Garbage Disposal:',
          'Stove:',
          'Hood:',
          'Microwave:',
          'Smart A/C Controls:',
        ],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — 95% DRAWINGS — ELECTRICAL',
        items: [
          'Recessed Ceiling Lighting:',
          'Fans Installation:',
          'Fans with Lights:',
          'Bathroom Exhaust Fan Lights:',
          'Soffit Lights:',
          'Electrical Outlets Location:',
          'Bathroom Fixture:',
          'Wall Insulation:',
          'Ceiling Insulation:',
        ],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — 95% DRAWINGS — ADDITIONAL OPTIONS & UPGRADES',
        items: [
          'Wall Texture:',
          'Ceiling Texture:',
          'Kitchen Backsplash:',
          'Solid Core Doors:',
          'Large Upper Cabinets:',
          'Crown Molding:',
          'Hose Bibs Location:',
          'Sanitary Line Upgrade:',
          'Soffit Material Preference:',
          'CASK to Landscape New Outdoor Space:',
          'Drywall in Garage:',
          'Non-Drywall Electrical Outlets:',
          'Glass Windows in Garage Door:',
        ],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — SIGNS AND TESTIMONIALS',
        items: [
          'Post Pre-Con Testimonial',
          'Post Construction Testimonial',
          'Pre-Construction Sign',
          'Construction Sign',
        ],
      },
    ],
    nps: true,
  },
  PR3m: {
    header: 'PR3m — Initial Alignment Meeting',
    subheader: 'Phase 1: Pre-Construction Pre-Design · Meeting',
    sections: [
      {
        title: 'MEETING INFORMATION',
        items: [
          'Date:',
          'Meeting Time:',
          'Location:',
          {
            text: 'Attendees:',
            sub: [
              'Property Owner/s:',
              'Project Manager:',
              'Project Specialist:',
              'Others:',
            ],
          },
        ],
      },
      {
        title: 'PURPOSE OF VISIT',
        items: [
          'Review overall project expectations',
          'Discuss budget alignment and scope',
          'Identify site limitations and considerations',
          'Establish communication flow and milestone tracking',
        ],
      },
      {
        title: 'PROJECT TIMELINE OVERVIEW',
        items: [
          'Design Phase — Standard: 2–3 months | Customer Preferred Time: ___',
          'Permitting Phase — Standard: 2–3 months | Customer Preferred Time: ___',
          'Estimated Construction Time — Standard: 4–7 months | Customer Preferred Time: ___',
          'Additional Milestones:',
        ],
      },
      {
        title: 'PROJECT PLACEMENT & LAYOUT PREFERENCES',
        items: [
          '(Please refer to sketch)',
          'Additional Notes:',
        ],
      },
      {
        title: 'FLOOR PLAN & DESIGN IDEAS',
        items: [
          'Open layout (everything flows together):',
          'More separated rooms:',
          'Kitchen placement preference:',
          'Number of bedrooms or workspaces:',
        ],
      },
      {
        title: 'PROPERTY & SITE DETAILS',
        items: [
          'Are there trees or landscaping that may affect the project?',
          'Where are existing utilities or easements?',
          'How will construction vehicles access the site?',
          'Where can we place the construction sign?',
        ],
      },
      {
        title: '50%–75% DRAWINGS — INTERIOR DESIGN & LAYOUT',
        items: [
          {
            text: 'Downstairs Garage: (If adding or updating a lower level, what will the space be used for?)',
            sub: [
              'Utility Area (Space for storage or equipment.)',
              'Laundry Area (Convenient spot for washer and dryer.)',
              'Bathroom (Adds function for guests or lower-level use.)',
              'Additional Notes:',
            ],
          },
          {
            text: 'Laundry Location: (Decide where your washer and dryer will go.)',
            sub: [
              'Upstairs (Easy access from bedrooms.)',
              'Garage (Saves space inside the home.)',
              'No Laundry (Not needed in this build.)',
              'Additional Notes:',
            ],
          },
          {
            text: 'Ceiling Height: (Standard per NBC is 8 feet.) — 1st Floor / 2nd Floor',
            sub: [
              '8 feet — Standard (Comfortable and cost-effective.)',
              '9 feet ($) (Adds extra height and a more open feeling.)',
              '10 feet ($$) (Provides a spacious, high-end look and feel.)',
              'Additional Notes:',
            ],
          },
          {
            text: 'Ceiling Style: (Flat or vaulted?)',
            sub: [
              'Flat Ceiling — Standard (Clean, modern look with level surface.)',
              'Vaulted Ceiling ($) (Raised, angled ceiling — more open and spacious.)',
              'Additional Notes:',
            ],
          },
        ],
      },
      {
        title: '50%–75% DRAWINGS — MECHANICAL & UTILITY OPTIONS',
        items: [
          {
            text: 'Air Condition Handler: (Where will the indoor A/C unit be installed?)',
            sub: [
              'Attic (Saves floor space but can be warmer.)',
              'Mini-Split System (Separate wall units for room-by-room control.)',
              'Additional Notes:',
            ],
          },
          {
            text: 'Separate Meters: (Ideal for tracking usage or renting independently.)',
            sub: [
              'Electric Meter: Yes / No (Separate billing for electricity.)',
              'Water Meter: Yes / No (Separate billing for water.)',
              'Gas Meter: Yes, but separate / Yes, but not separate / No (Natural gas service.)',
              'Additional Notes:',
            ],
          },
        ],
      },
      {
        title: '50%–75% DRAWINGS — EXTERIOR & STRUCTURAL FEATURES',
        items: [
          {
            text: 'Driveway Options: (Choose surface based on style and maintenance preference.)',
            sub: [
              'Crushed Limestone — Standard (Durable and affordable.)',
              'Concrete ($) (Clean, classic appearance.)',
              'Brick Pavers ($$) (Upscale look with color and texture.)',
              'Additional Notes:',
            ],
          },
          {
            text: 'Parking Options: (Select preferred surface material for parking areas.)',
            sub: [
              'Crushed Limestone — Standard (Functional and low-cost.)',
              'Concrete ($) (Neat and easy to maintain.)',
              'Brick Pavers ($$) (Decorative, premium appearance.)',
              'Additional Notes:',
            ],
          },
          {
            text: 'Outdoor Space: (Add a deck or patio for outdoor living?)',
            sub: [
              'Yes (Adds space for gatherings and relaxation.) — Describe size and location:',
              'No (Not needed for this project.)',
              'Additional Notes:',
            ],
          },
          {
            text: 'Garage Door Height: (Choose height that fits your vehicle or design preference.)',
            sub: [
              '7 feet — Standard (Fits most standard vehicles.)',
              '8 feet ($$) (Allows taller vehicles and creates a grander look.)',
              'Additional Notes:',
            ],
          },
        ],
      },
      {
        title: '95% DRAWINGS — EXTERIOR FINISHES & DETAILS',
        items: [
          {
            text: 'Decking Material: (Customize your outdoor living space.)',
            sub: [
              'Pressure Treated Lumber — Standard (Durable and traditional wood.)',
              'Composite ($) (Low-maintenance, modern, and long-lasting.)',
              'Additional Notes:',
            ],
          },
          {
            text: 'Landscaping: (Would you like CASK to landscape your new outdoor spaces?)',
            sub: [
              'Yes (Adds finishing touches and curb appeal.)',
              'No (Landscaping handled separately.)',
              'Additional Notes:',
            ],
          },
          {
            text: 'Garage Drywall: (Would you like drywall installed in the garage?)',
            sub: [
              'Yes ($) (Gives the garage a clean, finished look.)',
              'No (Garage remains unfinished.)',
              'Additional Notes:',
            ],
          },
        ],
      },
      {
        title: 'SCHEDULING & COORDINATION',
        items: [
          'Buildertrend Record Photo Taken: YES / NO',
          'Midway Design Meeting Scheduled:',
          'Coordination Notes:',
        ],
      },
      {
        title: 'YOUR GOAL FOR THIS PROJECT',
        items: [
          'What inspired you to start this project? (Extra space, income, family, etc.)',
          'Please answer in 2–3 sentences',
        ],
      },
    ],
    nps: true,
  },
  PR5m: {
    header: 'PR5m — On Site Flag with Customer',
    subheader: 'Phase 1: Pre-Construction Pre-Design · Meeting',
    sections: [
      {
        title: 'OBJECTIVE',
        items: [
          'Review the flagged property to outline the footprint of the project',
          'Confirm utility locations with the Project Manager',
        ],
      },
      {
        title: 'ATTENDEES',
        items: ['Customer', 'Project Manager'],
      },
      {
        title: 'AGENDA',
        numbered: true,
        items: [
          { text: 'Welcome & Introductions', sub: ['Quick overview of today\'s site visit and purpose'] },
          { text: 'Project Footprint Walkthrough', sub: ['Review flagged areas marking the layout of the project', 'Answer questions regarding boundaries and placement'] },
          { text: 'Utility Location Review', sub: ['Discuss identified utility locations', 'Confirm any adjustments needed for safety and access'] },
          { text: 'Next Steps', sub: ['Summarize outcomes of the site visit', 'Outline what will happen leading into the next stage'] },
          { text: 'Q&A / Customer Feedback', sub: ['Open discussion for customer questions, clarifications, or concerns'] },
        ],
      },
    ],
    nps: true,
  },
  PD1m: {
    header: 'PD1m — 50% Floor Plan with Customer',
    subheader: 'Phase 2: Pre-Construction Design · Meeting',
    sections: [
      {
        title: 'INITIAL SITE PLAN LAYOUT — TREES',
        items: [
          '1. Distance of tree(s) to building:',
          '2. Size of tree(s):',
        ],
      },
      {
        title: 'INITIAL SITE PLAN LAYOUT — UTILITIES',
        items: [
          {
            text: '1. Determine overhead electrical lines',
            sub: [
              'Does power to the main house need to be moved to construct the ADU?',
              '→ Yes: Method of moving electrical lines — Double meter can / Moving line on main / Duke service line',
              '→ No',
              'Does the owner want a separate electric meter for the ADU?',
              '→ Yes: Location of meter on ADU; Cost implications',
              '→ No: Location for ADU panel; Trenching needed from main house panel (Yes/No); Is main house power sufficient for ADU (Yes/No)',
            ],
          },
          {
            text: '2. Schedule for sanitary line to be located',
            sub: [
              'Is the sanitary line under the new ADU?',
              '→ Yes: Sections of sanitary that must be replaced',
              '→ No',
              'Does the homeowner want to replace the existing sanitary line?',
              '→ Yes: Routing of new line: ___',
              '→ No: Nothing further needed.',
            ],
          },
          {
            text: '3. Identify size of water line and where it ties into the main house',
            sub: [
              'If tied into existing house meter: Waterline location — where does ADU water line tie into main house water line?',
              'If not tied into home meter: Need for a new meter (Yes/No); Cost implications:',
            ],
          },
          {
            text: '4. Is there natural gas available on your property currently?',
            sub: [
              '→ Yes: What appliances do you want gas to service? / Where will it be fed? / Will it get a separate meter?',
              '→ No',
            ],
          },
        ],
      },
      {
        title: 'ESTABLISH LOCATION OF PARKING',
        items: [
          'Parking Location:',
        ],
      },
      {
        title: 'IF HISTORIC — SEND CUSTOMER EMAIL TO CLARIFY EXPECTATIONS',
        items: [
          'Yes (Explain to client for clarifications)',
          'No',
        ],
      },
      {
        title: 'ESTABLISH EXTERIOR DIMENSIONS',
        items: [
          'Dimensions:',
        ],
      },
      {
        title: 'WALL LAYOUT',
        items: [
          'Preferred layout of furniture (use to understand functionality and flow of space)',
        ],
      },
      {
        title: 'KITCHEN LAYOUT',
        items: [
          'Owner approves area of kitchen',
          'Special features of kitchen',
        ],
      },
    ],
    nps: true,
  },
  PS2m: {
    header: 'PS2m — In-Person 1st Selections with Customer',
    subheader: 'Phase 4: Pre-Construction Selections · Meeting',
    sections: [
      {
        title: 'ATTENDEES',
        items: ['Customer', 'Selections Manager', 'Project Manager'],
      },
      {
        title: 'OBJECTIVES',
        items: [
          'Review 3D rendering and identify any design changes',
          'Capture customer insights and preferences',
          'Flag any design elements that may impact other selections',
          'Obtain customer approval to move forward',
          'Provide customer with design packet (digital & print) for continued review prior to 2nd meeting',
        ],
      },
      {
        title: 'AGENDA',
        numbered: true,
        items: [
          { text: 'Welcome & Purpose of Meeting', sub: [] },
          { text: 'Review of 3D Rendering', sub: ['Walkthrough of design', 'Discuss potential changes', 'Gather customer input'] },
          { text: 'Design Impacts & Considerations', sub: ['Identify any elements that affect other selections (kitchen, bath, finishes, etc.)'] },
          { text: 'Customer Approval & Next Steps', sub: ['Confirm agreement to move forward', 'Provide design packet for review prior to 2nd selections meeting'] },
          { text: 'Q&A and Open Discussion', sub: [] },
        ],
      },
    ],
    nps: true,
  },
  PS4m: {
    header: 'PS4m — In-Person 2nd Selections with Customer',
    subheader: 'Phase 4: Pre-Construction Selections · Meeting',
    sections: [
      {
        title: 'ATTENDEES',
        items: ['Customer', 'Selections Manager', 'Project Manager'],
      },
      {
        title: 'OBJECTIVES',
        items: [
          'Review customer selections from Part 1 of the design book (focus on kitchen)',
          'Review any items the customer is sourcing independently',
          'Discuss kitchen layout, flow, and selections in detail',
        ],
      },
      {
        title: 'AGENDA',
        numbered: true,
        items: [
          { text: 'Welcome & Purpose of Meeting', sub: [] },
          { text: 'Review of Customer Selections', sub: ['Confirm Part 1 design book choices', 'Capture feedback and adjustments'] },
          { text: 'Kitchen Layout & Flow Discussion', sub: ['Walkthrough of layout', 'Review functionality and design flow'] },
          { text: 'Customer-Sourced Items', sub: ['Confirm details of items being sourced directly by customer', 'Review potential impacts on design or scheduling'] },
          { text: 'Approval & Next Steps', sub: ['Summarize today\'s selections and approvals', 'Outline preparations for next selections meeting'] },
          { text: 'Q&A / Open Discussion', sub: [] },
        ],
      },
    ],
    nps: true,
  },
  PS6m: {
    header: 'PS6m — In-Person 3rd Selections with Customer',
    subheader: 'Phase 4: Pre-Construction Selections · Meeting',
    sections: [
      {
        title: 'ATTENDEES',
        items: ['Customer', 'Selections Manager', 'Project Manager'],
      },
      {
        title: 'OBJECTIVES',
        items: [
          'Receive approval of Section 1 (Kitchen)',
          'Review any items customer is sourcing themselves',
          'Discuss bathroom layout, flow, and selections',
        ],
      },
      {
        title: 'AGENDA',
        numbered: true,
        items: [
          { text: 'Welcome & Purpose of Meeting', sub: [] },
          { text: 'Kitchen Final Review & Approval (Section 1)', sub: [] },
          { text: 'Bathroom Layout & Flow Discussion', sub: [] },
          { text: 'Customer-Sourced Items', sub: [] },
          { text: 'Next Steps & Homework Assignments', sub: [] },
          { text: 'Q&A / Open Discussion', sub: [] },
        ],
      },
    ],
    nps: true,
  },
  PS8m: {
    header: 'PS8m — In-Person 4th Selections with Customer',
    subheader: 'Phase 4: Pre-Construction Selections · Meeting',
    sections: [
      {
        title: 'ATTENDEES',
        items: ['Customer', 'Selections Manager', 'Project Manager'],
      },
      {
        title: 'OBJECTIVES',
        items: [
          'Review and approve Section 2 (Bathroom)',
          'Review any items customer is sourcing themselves',
          'Cover miscellaneous selections',
        ],
      },
      {
        title: 'AGENDA',
        numbered: true,
        items: [
          { text: 'Welcome & Purpose of Meeting', sub: [] },
          { text: 'Bathroom Selections – Final Review & Approval (Section 2)', sub: [] },
          { text: 'Miscellaneous Selections Review', sub: [] },
          { text: 'Customer-Sourced Items', sub: [] },
          { text: 'Next Steps & Wrap-Up', sub: [] },
          { text: 'Q&A / Open Discussion', sub: [] },
        ],
      },
    ],
    nps: true,
  },
  PB2m: {
    header: 'PB2m — In-Person Sewage and Water Inspection',
    subheader: 'Phase 5: Pre-Construction Bid Management · Meeting',
    sections: [
      {
        title: 'PROJECT DETAILS',
        items: [
          'Date:',
          'Project Name:',
          'Customer Contact:',
          'Project Manager Assign:',
        ],
      },
      {
        title: 'WATERLINE — MARK ON PLANS',
        items: [
          'Position Water Meter Main House on the plan',
          'Position Main Shut Off valve close to the main house (T point for ADU)',
        ],
      },
      {
        title: 'WATERLINE — NOTES',
        items: [
          'Pipe Material:',
          'Any problem that could occur during construction (Possible Tree/Roots, Pavers, etc.):',
          'Notes & Recommendation:',
        ],
      },
      {
        title: 'SEWER — MARK ON PLANS',
        items: [
          'Position Sewer Tap',
          'Where Sewer run on the plan',
          'Any Clean out if present',
        ],
      },
      {
        title: 'SEWER — NOTES',
        items: [
          'Sewer Material and Condition:',
          'Notes & Recommendation:',
        ],
      },
      {
        title: 'ATTACHMENTS',
        items: ['Please attach any pictures'],
      },
    ],
    nps: true,
  },
  PB5m: {
    header: 'PB5m — Contract Review with Customer',
    subheader: 'Phase 5: Pre-Construction Bid Management · Meeting',
    sections: [
      {
        title: 'CONTRACT REVIEW WORKFLOW',
        numbered: true,
        items: [
          {
            text: 'Receive Contract Draft',
            sub: [
              'From internal legal/contracts team or directly from client',
              'Save and version the document',
            ],
          },
          {
            text: 'Initial Review by Project Manager',
            sub: [
              'Review scope of work',
              'Verify schedule and milestones',
              'Confirm payment structure',
              'Identify risks, liabilities, and special clauses',
            ],
          },
          {
            text: 'Flag Issues & Draft Comments',
            sub: [
              'Note inconsistencies, vague language, or missing items',
              'Coordinate with Legal for legal/insurance terms',
              'Coordinate with Estimating for cost implications',
              'Coordinate with Scheduling for timeline feasibility',
            ],
          },
          {
            text: 'Internal Team Review & Alignment',
            sub: [
              'Meet with Contracts/Legal',
              'Meet with Estimating/Finance',
              'Meet with Executive/Director (if needed)',
              'Finalize your team\'s position on edits',
            ],
          },
          {
            text: 'Share Feedback with Client',
            sub: [
              'Return redlined contract or comment summary',
              'Schedule a review meeting to walk through changes',
              'Aim for mutual agreement on scope, schedule, and terms',
            ],
          },
          {
            text: 'Final Contract Revisions',
            sub: [
              'Incorporate agreed edits',
              'Confirm all terms are updated accurately',
              'Legal/PM do final internal check',
            ],
          },
          {
            text: 'Execute Contract',
            sub: [
              'Both parties sign the finalized contract (digital or hard copy)',
              'Distribute fully executed copy to stakeholders',
            ],
          },
          {
            text: 'Project Kickoff',
            sub: [
              'Hold internal kickoff meeting',
              'Share contract details with delivery team',
              'Launch project planning and mobilization',
            ],
          },
        ],
      },
    ],
    nps: true,
  },
  CG1m: {
    header: 'CG1m — Kickoff with Customer',
    subheader: 'Phase 6: Construction Groundbreaking · Meeting',
    sections: [
      {
        title: 'ITEMS TO PREPARE AHEAD OF MEETING',
        items: [
          'Create As-Built Folder on server',
          'Updated field set of drawings',
          'Cabinet layout',
          'Updated BuilderTrend schedule',
          'Window Spec. RO and sizes',
          'Selection Packet',
        ],
      },
      {
        title: 'PROJECT DETAILS',
        items: [
          'Date:',
          'Time:',
          'Location:',
          { text: 'Attendees:', sub: ['Project Manager', 'Superintendent', 'Customer', 'Other:'] },
        ],
      },
      {
        title: 'MEETING FLOW',
        numbered: true,
        items: [
          { text: 'Welcome and Introductions', sub: ['Brief intro of all attendees', 'Meeting objectives overview'] },
          { text: 'Review of Site Plan', sub: ['Presentation of site plan', 'Questions/concerns addressed'] },
          { text: 'Insulation in Walls and Ceilings', sub: ['Walls insulation type:', 'Ceilings insulation type:', 'Areas without insulation:'] },
          { text: 'Wall and Ceiling Finishes', sub: ['Areas without drywall:', 'Drywall finish type:'] },
          { text: 'Electrical Layout', sub: ['Layout plan reviewed', 'Placement of: Light fixtures, Switches, Outlets', 'Special requirements:'] },
          { text: 'Kitchen Layout', sub: ['Changes to wall/window layout: Yes / No', 'Layout reviewed', 'Appliances and cabinet placement:', 'Special features/customizations:'] },
          { text: 'Bathroom Layout and Floors', sub: ['Tile pattern/layout reviewed', 'Niche/valve/vanity/mirror placement:', 'Plumbing fixtures & lighting confirmed', 'Flooring pattern/direction:'] },
          { text: 'Plumbing Layout', sub: ['Plumbing plan reviewed', 'Centerline of all plumbing fixtures', 'Hose bibs & water heater location:', 'Special plumbing requirements:'] },
          { text: 'HVAC Layout', sub: ['HVAC plan reviewed', 'Placement of: Air handlers, Condensers, Vents', 'Special HVAC requirements:'] },
          { text: 'Window and Door Placement', sub: ['Window layout reviewed and sizes / RO', 'Bathroom door 2-8 size minimum', 'Special window placement requirements:'] },
          { text: 'Wall Finishes', sub: ['Interior type of finishes discussed', 'Exterior wall finish', 'Special wall finish requirements:'] },
          { text: 'BuilderTrend Schedule', sub: ['Schedule/timeline reviewed', 'Milestones and deadlines discussed', 'Scheduling concerns:'] },
          { text: 'Backyard Construction Space', sub: ['Space coordination with owner', 'Temporary fencing needed? Yes / No'] },
          { text: 'Demo (if applicable)', sub: ['Demo plan reviewed', 'Power shutoff procedure', 'Special demo requirements:'] },
          { text: 'Q&A and Next Steps', sub: ['All attendee questions addressed', 'Outline of next construction steps', 'Next meeting scheduled:'] },
        ],
      },
    ],
    nps: true,
  },
  'CG2.a': {
    header: 'CG2.a — Demo (If Needed)',
    subheader: 'Phase 6: Construction Groundbreaking · Internal',
    sections: [
      {
        title: 'SUPERINTENDENT CHECKLIST',
        items: [
          'Disconnect all necessary utilities prior to demo',
          'Contact 811 Dig to mark underground utilities',
          'Prepare demo site by clearing access, securing the work area, and confirming equipment readiness',
          'Remove required items from the area such as fencing, debris, or obstructions',
          'Confirm safe site conditions for demo in line with guidelines',
        ],
      },
    ],
  },
  'CG2.b': {
    header: 'CG2.b — Site Survey Layout',
    subheader: 'Phase 6: Construction Groundbreaking · Internal',
    sections: [
      {
        title: 'SUPERINTENDENT CHECKLIST',
        items: [
          'Schedule survey with surveyor',
          'Request pinning of building corners and blue-top elevation',
          'Verify setbacks are accurate for side, rear, front, and stairs if applicable',
          'Confirm survey pins and layout match permitted plans',
        ],
      },
    ],
  },
  CG2e: {
    header: 'CG2e — Kickoff Meeting Recap to Customer',
    subheader: 'Phase 6: Construction Groundbreaking · Email Template',
    sections: [
      {
        title: 'EMAIL HEADER',
        items: [
          'Subject: Kick-Off Meeting Recap & Next Steps – [Project Address or Name]',
          'From: [Project Manager]',
          'To: [Customer Name]',
          'Cc: [Superintendent]',
        ],
      },
      {
        title: 'OPENING',
        items: [
          'Hi [Customer Name],',
          'It was a pleasure meeting with you and discussing your vision for the project at [Project Address]. We truly appreciate your time and input, and we\'re excited to move forward together. Below is a quick recap of our conversation and what to expect next.',
        ],
      },
      {
        title: 'MEETING NOTES',
        items: [
          '[Project Manager to input key discussion points here]',
          '–',
          '–',
          '–',
        ],
      },
      {
        title: 'SCHEDULING & UPCOMING MILESTONES',
        items: [
          'Next Meeting: Foundation & Slab-on-Grade Meeting',
          'Date & Time: [Insert details]',
          'Next Milestone: We\'ll be reaching out soon with updates regarding: [Insert Next Milestone]',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Please don\'t hesitate to reach out if anything comes to mind — questions, ideas, or clarifications.',
          'Survey: Construction Phase Feedback Survey (Customer Journey Survey Handout)',
          'We\'re looking forward to building something great with you!',
        ],
      },
    ],
  },
  'CG3.a': {
    header: 'CG3.a — Internal Sub Meeting',
    subheader: 'Phase 6: Construction Groundbreaking · Internal',
    sections: [
      {
        title: 'ATTENDANCE',
        items: ['Superintendent:', 'Subcontractors:'],
      },
      {
        title: 'AGENDA',
        items: [
          'Email field set of plans to subcontractors',
          'Walk the job site with subs and review scope of work for each trade',
          'Framer – review any changes to elevation, double check window, door, and garage door openings, wall finishes, and truss layout',
          'Concrete – review any changes to elevation, double check window, door, and garage door openings, wall finishes, and truss layout',
          'Electrician – review installation plan and double check all underground',
          'Plumber – review installation plan and double check all underground',
        ],
      },
    ],
  },
  CG3m: {
    header: 'CG3m — Foundation and Slab On Grade with Customer',
    subheader: 'Phase 6: Construction Groundbreaking · Meeting',
    sections: [
      {
        title: 'ITEMS TO PREPARE AHEAD OF MEETING',
        items: [
          { text: 'Updated field set of drawings', sub: ['Cabinet layout', 'Review window location and elevations (window rough openings)', 'Window specs and quote from supplier'] },
          'Lot needs to be pinned and blue top',
          'Sanitary line needs to be scoped, and condition of sanitary line should be determined by plumber',
        ],
      },
      {
        title: 'PROJECT DETAILS',
        items: [
          'Date:',
          'Time:',
          'Location:',
          { text: 'Attendees:', sub: ['Superintendent', 'Customer', 'Other:'] },
        ],
      },
      {
        title: 'MEETING FLOW',
        numbered: true,
        items: [
          { text: 'Welcome and Introductions', sub: ['Quick overview of meeting objectives', 'Set expectations for entering the structural phase'] },
          { text: 'BuilderTrend Schedule Review', sub: ['Review structural milestones in BuilderTrend', 'Confirm projected dates for: Concrete pour, Formwork, Inspections', 'Identify any permitting/demo delays'] },
          { text: 'Site Walkthrough – Key Verifications', sub: ['Verify window sizes', 'Verify window locations', 'Verify siding finish material (i.e. if finished block needs be called out)', 'Corners of building clearly marked', 'Rear setback verified', 'Side setback verified', 'Front setback verified', 'Stair location reviewed (if applicable)', 'Stair zoning setbacks confirmed (if applicable)', 'Slab-on-grade elevation validated', 'Sanitary/sewer line condition assessed — Replacement required? Yes / No'] },
          { text: 'Q&A and Next Steps', sub: ['Address any remaining questions or concerns', 'Confirm understanding of next steps', 'Schedule formwork, inspection, and pour', 'Log updates into BuilderTrend', 'Coordinate any follow-up items with customer'] },
        ],
      },
    ],
    nps: true,
  },
  CG4e: {
    header: 'CG4e — Foundation and Slab On Grade Meeting Recap',
    subheader: 'Phase 6: Construction Groundbreaking · Email Template',
    sections: [
      {
        title: 'EMAIL HEADER',
        items: [
          'Subject: Foundation & Slab-on-Grade Meeting Recap & Next Steps – [Project Address or Name]',
          'From: [Project Manager]',
          'To: [Customer Name]',
          'Cc: [Superintendent]',
        ],
      },
      {
        title: 'OPENING',
        items: [
          'Hi [Customer Name],',
          'It was great spending time with you during the walkthrough at [Project Address] and reviewing the final stages of your project. We\'re grateful for your feedback and collaboration throughout this process. Below is a summary of our discussion along with what\'s coming next.',
        ],
      },
      {
        title: 'MEETING NOTES',
        items: [
          '[Project Manager to input key discussion points here]',
          '–',
          '–',
          '–',
        ],
      },
      {
        title: 'SCHEDULING & UPCOMING MILESTONES',
        items: [
          'Next Meeting: (Meeting Title)',
          'Date & Time: [Insert details]',
          'Next Milestone: We\'ll be reaching out soon with updates regarding: [Insert Next Milestone]',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'If you have any follow-up thoughts — please don\'t hesitate to reach out. Our goal is to keep everything clear, efficient, and aligned with your expectations from start to finish.',
          'Survey: Construction Phase Feedback Survey (Customer Journey Survey Handout)',
          'We\'re excited to bring your vision across the finish line!',
        ],
      },
    ],
  },
  CS1e: {
    header: 'CS1e — Structure Stage Expectations Recap to Customer',
    subheader: 'Phase 7: Construction Structure · Email Template',
    sections: [
      {
        title: 'EMAIL HEADER',
        items: [
          'Subject: Structure Stage Preview & Celebration – [Project Address]',
          'From: [Project Manager Name]',
          'To: [Customer Name]',
          'Cc: Superintendent, Framing Team, Concrete Team',
        ],
      },
      {
        title: 'OPENING',
        items: [
          'Hi [Customer Name],',
          'We\'re very excited to start the structure stage of your project! This is when your vision starts to come to reality. After this stage, you will be able to walk in your future rooms to see the plans you designed with us in action!',
          'As we approach the structure phase for [Project Address], please review the following expectations, schedules, and coordination items:',
        ],
      },
      {
        title: "WHAT'S COMING UP (BASED ON BUILDERTREND SCHEDULE)",
        items: [
          'Framing progression',
          'Roof setup and inspections',
          'Wall sheathing installation',
          'Prep for Mechanical, Electrical, Plumbing (MEP) rough-ins',
        ],
      },
      {
        title: "WHO YOU'LL SEE ON-SITE",
        items: [
          'Our framing crew',
          'Concrete specialists (if applicable)',
          'Structural inspectors',
          'Underground plumbing and electrical if applicable',
        ],
      },
      {
        title: 'BEST PRACTICES',
        items: [
          'We\'ll notify nearby neighbors about increased site activity',
          'All teams have been made aware of special conditions regarding parking and storing of material',
          'Let us know if you have any questions, conflicts, or ideas — we\'re here to make this process as smooth and exciting as possible.',
        ],
      },
      {
        title: 'WHAT TO LOOK FORWARD TO: STRUCTURE COMPLETE CELEBRATION',
        items: [
          'We\'d love to mark this milestone with you!',
          'Please confirm a date/time that works best for your Structure Complete Meeting.',
          'Suggested Date: [Insert Proposed Date]',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Survey: Construction Phase Feedback Survey (Customer Journey Survey Handout)',
          'Looking forward to celebrating this big step with you!',
        ],
      },
    ],
  },
  CS2m: {
    header: 'CS2m — Structure Complete Celebration with Customer',
    subheader: 'Phase 7: Construction Structure · Meeting',
    sections: [
      {
        title: 'ITEMS TO PREPARE AHEAD OF MEETING',
        items: [
          'Updated field set of drawings',
          'Bring selections packet (vanities, lighting fixtures, plumbing fixtures)',
          'Final kitchen layout – dimensions included on updated field set of plans',
          'Updated ID drawing',
        ],
      },
      {
        title: 'PROJECT DETAILS',
        items: [
          'Date:',
          'Time:',
          'Location:',
          { text: 'Attendees:', sub: ['Project Manager', 'Superintendent', 'Customer', 'Other:'] },
        ],
      },
      {
        title: 'MEETING FLOW',
        numbered: true,
        items: [
          { text: 'Welcome & Overview', sub: ['Celebrate structure milestone', 'Set expectations for the next construction phase'] },
          { text: 'BuilderTrend Schedule Review', sub: ['Review updated schedule', 'Highlight upcoming stages: Rough-In (MEP), Inspections, Drywall'] },
          {
            text: 'Plan Set & Field Markup Review — Confirm details for Electrical, Plumbing, HVAC layout',
            sub: [
              'Bedroom: Lighting locations, Switch locations, Outlet locations, Fans, Lights (Yes/No)',
              'Bathroom: Lighting locations, Switch locations, Outlet locations, Vanity type, Plumbing for vanity, Fans, Lights (Yes/No)',
              'Kitchen: Lighting locations, Switch locations, Outlet locations, Under cabinet lighting, Hood, Garbage disposal, Dishwasher, Ice maker water line box, Fans, Lights (Yes/No)',
              'Living Room: Lighting locations, Switch locations, Outlet locations, Fans, Lights (Yes/No)',
              'Outside Area: Lighting locations, Switch locations, Outlet locations, Hose bibs, Water heater location, Fans, Lights (Yes/No)',
              'Garage: Lights, Outlets, Switches, Garage door controls',
              'Misc: Laundry closet/utility area, Wet bar area if applicable, Inside/outside area if applicable',
            ],
          },
          { text: 'Neighbor Communication', sub: ['Discuss any feedback or concerns raised by neighbors', 'Determine if formal communication from CASK is needed'] },
          { text: 'Job Site Verification', sub: ['Confirm construction sign is posted', 'Confirm job box is in place', 'Ensure QR code sheet is available and links to updated plans'] },
          { text: 'Q&A and Next Steps', sub: ['Address customer questions', 'Confirm what\'s coming next', 'Align on any follow-up action items'] },
        ],
      },
    ],
    nps: true,
  },
  CS3e: {
    header: 'CS3e — Structure Complete Celebration Meeting Recap to Customer',
    subheader: 'Phase 7: Construction Structure · Email Template',
    sections: [
      {
        title: 'OPENING',
        items: [
          'Good afternoon,',
          'Here is my weekly recap of this week\'s progress at my projects:',
        ],
      },
      {
        title: 'THEE — CURRENT STATUS',
        items: [
          'Final electrical has been passed (3/20). All appliances are up and running including HVAC. Sod and irrigation completed. Final drainage was passed today as well. I uploaded final survey and blower door and Hazel has submitted our CO application. Final building is scheduled for Monday. Final paint is slated to be completed tomorrow.',
        ],
      },
      {
        title: 'THEE — UPCOMING WORK',
        items: [
          { text: 'Interior:', sub: ['Final clean scheduled for Monday', 'Shower glass is scheduled 3/27 between 11am-1pm', 'RP punch: Add switch plate to bedroom, Add floor outlet, One can light in living room not turning on, swap garage ceiling light (fixture onsite)', 'Punch list items are being added to Buildertrend'] },
          { text: 'Exterior:', sub: ['Pressure wash deck, stairs, and siding'] },
        ],
      },
      {
        title: 'THEE — PRICING/SCOPE QUESTIONS',
        items: [
          'Irrigation guy is asking to get paid asap. He submitted his COI and W9.',
        ],
      },
      {
        title: 'THEE — RISK/AWARENESS',
        items: [
          'The fridge looks very funny with it being 24" in a 36" opening. Was this expectation set with homeowner? I will browse some options of what we can do for a 12" filler. Maybe some extra storage because I know that was a big goal of theirs with the cabinet design.',
        ],
      },
      {
        title: 'THEE — NEXT STEPS',
        items: [
          'Almost confident we will get CO next week! I plan on meeting the building inspector there Monday morning to push it through and address any questions he may have.',
        ],
      },
      {
        title: 'HERMANN — CURRENT STATUS',
        items: [
          'Bathroom is completed and fully operational. Just need to final out electrical inspection when they get back home and do an official punch walk.',
        ],
      },
      {
        title: 'HERMANN — UPCOMING WORK',
        items: [
          'Jacinto is scheduled to start 3/30. RP and Knotts are in queue to pull utilities off walls mid-end of next week.',
        ],
      },
      {
        title: 'HERMANN — PRICING/SCOPE QUESTIONS',
        items: [
          'There are some tricky details going on in the front porch, and I just want to communicate it to the homeowners prior so it is not a surprise. (trim sizes, sills, etc.)',
        ],
      },
      {
        title: 'HERMANN — RISK/AWARENESS',
        items: [
          'This is going to be a big job. There is a lot of moving parts so will require a lot of supervision and communication when/if something pops up. Still wondering if we need a sheathing inspection. Maybe an in-progress to get the approval of our installation? Just want to make sure we don\'t get hit at the end for not scheduling.',
        ],
      },
      {
        title: 'HERMANN — NEXT STEPS',
        items: [
          'Going to walk the project next week with Calin to discuss details and scope so everyone is on the same page.',
          'Let me know if you guys have any questions or concerns!',
          'Thank you, Eric Bressler',
        ],
      },
    ],
  },
  CC4m: {
    header: 'CC4m — Final Walkthrough with Customer',
    subheader: 'Phase 10: Construction Closeout · Meeting',
    sections: [
      {
        title: 'INTRODUCTION',
        items: [
          'Project Manager to start by explaining the status of Certification of Completion (CO) and closing out of Permit.',
          'State the overall purpose of the meeting: to ensure the customer is confident and satisfied with the product, aiming for 100% satisfaction by the conclusion of the meeting.',
        ],
      },
      {
        title: 'INTERIOR WALKTHROUGH',
        items: [
          {
            text: 'Doors and Windows',
            sub: [
              'Touch and test every door and window to ensure proper opening and closing.',
              'Demonstrate how to open, close, and lock all windows.',
            ],
          },
          {
            text: 'Appliances',
            sub: [
              'Test all appliances to confirm they are working properly.',
            ],
          },
          {
            text: 'Walls and Rooms',
            sub: [
              'Ensure the customer sees every wall in each room to identify any punch list items and mark with blue tape where necessary.',
            ],
          },
          {
            text: 'Thermostat',
            sub: [
              'Operate thermostat with the homeowner to ensure proper function.',
            ],
          },
        ],
      },
      {
        title: 'EXTERIOR WALKTHROUGH',
        items: [
          {
            text: 'Property Perimeter',
            sub: [
              'Walk around the outside of the property with the customer.',
              'Point out all utility connections.',
              'Identify any exterior punch list items.',
            ],
          },
          {
            text: 'Signage',
            sub: [
              'Remove any signage from the property.',
            ],
          },
        ],
      },
      {
        title: 'FINAL STEPS',
        items: [
          {
            text: 'Punch List Review',
            sub: [
              'Review all punch list items with the customer to confirm nothing was missed.',
            ],
          },
          {
            text: 'ADU Best Practices Sheet',
            sub: [
              'Provide customer with the CASK ADU Best Practices sheet.',
            ],
          },
        ],
      },
      {
        title: 'FINAL MEETING SUMMARY',
        items: [
          'Confirm all major systems (electrical, plumbing, HVAC) were demonstrated and are in working order.',
          'Ensure customer understands maintenance recommendations and best practices.',
          'Provide any necessary warranty information and emergency contact details.',
          'Answer any final questions or concerns.',
        ],
      },
      {
        title: 'CUSTOMER ACKNOWLEDGEMENT',
        items: [
          'I acknowledge that I have completed the final walkthrough and understand any remaining punch list items that are to be addressed post-meeting.',
          'Customer Signature: _________________',
          'Project Manager Signature: _________________',
          'Date: _________________',
        ],
      },
      {
        title: 'CASK BEST PRACTICES',
        items: [
          {
            text: 'General Maintenance',
            sub: [
              'Regular Cleaning: Keep surfaces, floors, and appliances clean to prevent early wear.',
              'Moisture Control: Use exhaust fans in kitchens and bathrooms to avoid mold and mildew.',
              'Pest Prevention: Seal all food and dispose of trash regularly; inspect for possible entry points.',
              'Smoke Detectors: Test monthly and replace batteries every 6 months.',
              'Minisplit Filters: Required to be cleaned once every month to preserve your air handler and keep it in good operating condition.',
            ],
          },
          {
            text: 'Doors, Windows, and Appliances',
            sub: [
              'Windows: Keep tracks clean to ensure smooth operation.',
              'Doors: Avoid slamming; check hinges yearly and apply lubricant if needed.',
              'Appliances: Refer to each manufacturer\'s manual; most warranties are managed directly with them.',
            ],
          },
          {
            text: 'Walls and Thermostat',
            sub: [
              'Walls: Use proper anchors for hanging objects—no heavy items on drywall without stud support.',
              'Thermostat: Program it for energy efficiency. For issues, refer to the manual or contact your project manager.',
            ],
          },
          {
            text: 'Appliance Warranty and Service Questions - Famous Tate',
            sub: [
              'Who to Contact: Visit FamousTate.com/warranty or contact their Warranty Department directly.',
              'Warranty Items: You\'ll receive a warranty sheet detailing what\'s covered and how long coverage lasts.',
            ],
          },
          {
            text: 'Final Documents & Registrations',
            sub: [
              'Certificate of Occupancy: Your PM will provide this once city approval is completed.',
              'Post Office Setup: Visit your local post office to register the address for mail delivery.',
              'Water & Trash Setup: Contact the City of St. Pete to set up or confirm water and trash services if needed.',
            ],
          },
          {
            text: 'Utility Transfer & Owner Actions',
            sub: [
              'Electric Service (Duke Energy): You\'re responsible for transferring the electric service. Your PM will confirm when to take action.',
              'Ongoing Utility Billing: After project closeout, all utility billing will be under your name.',
            ],
          },
          {
            text: 'If You\'re Renting Your Space',
            sub: [
              'City Confirmation Letter: After the Certificate of Occupancy (COO) is issued, the City of St. Pete or Pinellas County will send you a letter confirming the approved use.',
              'Homestead Exemption Impact: If the space is intended to be rented, this may impact your homestead exemption.',
            ],
          },
          {
            text: 'What Happens After Today',
            sub: [
              'Our CASK Construction Creative Director will reach out to schedule your testimonial and final photos.',
              'Please take a moment to leave us an Online Review (link provided by the PM).',
              'Refer a Friend - Earn $1,000! Know someone dreaming of starting their own project? If they sign with CASK and start their project, you\'ll receive a $1,000 referral bonus.',
            ],
          },
        ],
      },
    ],
  },
  CC3e: {
    header: 'CC3e — Punch List Walkthrough Meeting Recap to Customer',
    subheader: 'Phase 10: Construction Closeout · Email',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Subject: Punch List Walkthrough Recap & Next Steps – [Project Address or Name]',
          'From: [Project Manager Name]',
          'To: [Customer Name]',
          'Cc: Superintendent, Marketing Manager',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Hi [Customer Name],',
          'Thank you for walking around the site with us today during your Punch List Walkthrough at [Project Address]. We\'re grateful for your time and attention to detail as we work toward wrapping up your project with confidence.',
          'Below is a summary of what we reviewed and what to expect moving forward:',
        ],
      },
      {
        title: 'MEETING NOTES',
        items: [
          '[Project Manager provides the meeting notes]',
          '-',
          '-',
          '-',
        ],
      },
      {
        title: 'WHAT\'S NEXT',
        items: [
          '– Our team will begin addressing all outstanding items immediately',
          '– You\'ll receive updates via Buildertrend as items are completed',
          '– Once all punch list items are marked as complete, we\'ll schedule the Final Walkthrough',
          'If you have any follow-up concerns or items to add, feel free to reach out—we want to ensure that everything meets your expectations before the project closes out.',
          'To help us continue delivering a top-tier construction experience, we\'d appreciate it if you could take a minute to answer our Construction Phase Feedback Survey. Your input goes a long way in helping us improve!',
          'CUSTOMER JOURNEY SURVEY HANDOUT',
          'We\'re almost there! Thank you for your partnership and trust throughout this journey.',
        ],
      },
    ],
  },
  CC2m: {
    header: 'CC2m — Punchlist Walkthrough with Customer',
    subheader: 'Phase 10: Construction Closeout · Meeting',
    sections: [
      {
        title: 'ITEMS TO PREPARE AHEAD OF MEETING',
        items: [
          'Updated field set of drawings',
          'Bring selections packet (vanities, lighting fixtures, plumbing fixtures)',
          'Updated kitchen layout',
          'Updated ID drawing',
          'Customer and superintendent Buildertrend punch list',
        ],
      },
      {
        title: 'ATTENDANCE',
        items: [
          'Project Manager',
          'Superintendent',
          'Customer',
        ],
      },
      {
        title: 'MEETING FLOW',
        numbered: true,
        items: [
          {
            text: 'Welcome & Meeting Purpose',
            sub: [
              'Explain the goal of the walkthrough: verify completion and identify final punch items',
              'Confirm all teams are aligned on the close-out timeline',
            ],
          },
          {
            text: 'Site Walkthrough – Punch Item Review',
            sub: [
              'Walk each room/zone of the project',
              'Identify and document: Missing Items, Items needing repair or touch-up, Items requiring adjustment (e.g., hardware alignment, paint touchups, etc.)',
            ],
          },
          {
            text: 'Live Updates to Punch List',
            sub: [
              'Log all noted issues into Buildertrend or project tracker',
              'Assign responsible trades/subs',
              'Set target dates for resolution',
            ],
          },
          {
            text: 'Customer Sign-Off',
            sub: [
              'Final inspections (if applicable)',
              'Schedule turnover meeting',
              'Final site cleanup',
            ],
          },
        ],
      },
    ],
    nps: true,
  },
  'CC1e.1': {
    header: 'CC1e.1 — Certificate of Occupancy to Customer',
    subheader: 'Phase 10: Construction Closeout · Email',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Project Manager',
          'Cc: Superintendent',
          'Subject: Congratulations! Your Project Has Received Its Certificate of Occupancy',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Hi [Customer Name],',
          'Great news — your project has officially received its Certificate of Occupancy! This is a major milestone, and it means your space has passed all final inspections and is approved for use.',
          'Your project has come a long way, and we\'re thrilled to reach this important completion stage with you.',
        ],
      },
      {
        title: 'NEXT STEPS',
        items: [
          'Final Walkthrough: I will be reaching out to schedule a final walkthrough to ensure everything is complete and meets your expectations.',
          'Closeout Documents: We will provide any remaining documentation related to your project, including warranties, manuals, and final photos (if applicable).',
          'Final Invoice: If there are any outstanding balances, our team will issue the final invoice for your review.',
          'If you have any questions as we wrap things up or need anything clarified, please feel free to reach out at any time.',
        ],
      },
    ],
  },
  CC1e: {
    header: 'CC1e — Close Out Steps to Customer',
    subheader: 'Phase 10: Construction Closeout · Email',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Subject: Final Steps & Punch List Walkthrough – [Project Address or Name]',
          'From: [Project Manager Name]',
          'To: [Customer Name]',
          'Cc: Superintendent',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Hi [Customer Name],',
          'As we approach the final stretch of your project at [Project Address], we\'re excited to begin the close-out process and schedule your punch list walkthrough. This is where we tie up final details and prepare for project turnover.',
        ],
      },
      {
        title: 'AVAILABLE TIMES FOR PUNCH LIST WALKTHROUGH',
        items: [
          'Please let us know which of the following dates and times work best for you:',
          '– [Option 1: Date & Time]',
          '– [Option 2: Date & Time]',
          '– [Option 3: Date & Time]',
          'This walkthrough gives us a chance to walk the space with you, note any outstanding items, and ensure everything is to your satisfaction before final turnover.',
        ],
      },
      {
        title: 'WHAT HAPPENS DURING CLOSE-OUT',
        items: [
          'Here\'s what to expect in the coming days:',
          '– Punch List Creation: We\'ll document any touch-ups or final items to be completed',
          '– Permitting & Final Inspections: We\'ll manage the final steps to close out permits with the city',
          '– Turnover: Once all punch list items are completed, we\'ll schedule your final hand-off and provide any necessary documents or warranty info',
          'If you have any questions before the walkthrough or would like to request something in advance, feel free to reach out. We\'re here to make this final stage smooth and exciting!',
        ],
      },
      {
        title: 'HELP US IMPROVE',
        items: [
          'To help us continue delivering a top-tier construction experience, we\'d appreciate it if you could take a minute to answer our Construction Phase Feedback Survey. Your input goes a long way in helping us improve!',
          'CUSTOMER JOURNEY SURVEY HANDOUT',
          'Looking forward to wrapping up strong and handing over your beautiful space soon!',
        ],
      },
    ],
  },
  CF2e: {
    header: 'CF2e — Finish Meeting Recap to Customer',
    subheader: 'Phase 9: Construction Finish · Email',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Subject: Finish Stage Meeting Recap & What\'s Next – [Project Address or Name]',
          'From: [Project Manager Name]',
          'To: [Customer Name]',
          'Cc: Superintendent, Selections Manager, Relevant Subcontractors',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Hi [Customer Name],',
          'It was such a pleasure meeting with you today on-site! We\'re officially in the finish stage—a huge milestone where your vision really starts coming to life. Thanks again for your time, input, and partnership throughout this journey.',
          'Here\'s a quick recap of what we discussed and what you can expect next:',
        ],
      },
      {
        title: 'MEETING NOTES',
        items: [
          '[Project Manager to input key discussion points here]',
          '–',
          '–',
          '–',
        ],
      },
      {
        title: 'WHAT\'S COMING UP',
        items: [
          '– We\'ll be wrapping up drywall and beginning finish installations very soon',
          '– Your job box has been updated with your full selections packet and QR code sheet for quick reference',
          '– You\'ll start seeing more trades on-site, and we\'ll continue sending progress updates along the way',
          'Please don\'t hesitate to reach out if anything else comes to mind—we want every detail to reflect your style and goals. We\'re so excited to see this next chapter unfold!',
          'To help us continue delivering a top-tier construction experience, we\'d appreciate it if you could take a minute to answer our Construction Phase Feedback Survey. Your input goes a long way in helping us improve!',
          'CUSTOMER JOURNEY SURVEY HANDOUT',
          'Thanks again for letting us build this with you. We\'re almost there!',
        ],
      },
    ],
  },
  CF1m: {
    header: 'CF1m — Finishes with Customer',
    subheader: 'Phase 9: Construction Finish · Meeting',
    sections: [
      {
        title: 'ITEMS TO PREPARE AHEAD OF MEETING',
        items: [
          'Updated field set of drawings',
          'Bring selections packet (vanities, lighting fixtures, plumbing fixtures)',
          'Updated kitchen layout',
          'Updated ID drawing',
        ],
      },
      {
        title: 'ATTENDANCE',
        items: [
          'Project Manager',
          'Superintendent',
          'Selections Manager',
          'Customer',
        ],
      },
      {
        title: 'MEETING FLOW',
        numbered: true,
        items: [
          {
            text: 'Welcome & Milestone Acknowledgment',
            sub: [
              'Congratulate customer for reaching this stage',
              'Celebrate the near completion of customer project',
            ],
          },
          {
            text: 'Buildertrend Schedule Review',
            sub: [
              'Set expectations for drywall hanging and items scheduled after',
              'Start of customer-selected finishes',
            ],
          },
          {
            text: 'Selections & Finish Confirmation',
            sub: [
              'Review the selections packet',
              'Walk through each finish scope, room by room:',
              'Bedroom: Flooring, Ceiling Fans, Paint, Tile Route, Trim, Fixtures',
              'Kitchen: Flooring, Cabinets, Under Cabinet lighting, Paint, Tile Route, Grout, Trim, Fixtures',
              'Bathroom: Flooring, Vanity, Paint, Tile on Walls, Shower Flooring, Bathroom Flooring, Trim, Fixtures, Niche, Schluter, Grout',
              'Living Room: Lighting, Fans, Flooring, Stair Tread Finish',
              'Garage: Wall Finishes, Utility Area, Lighting, Flooring',
              'Outside Area: Wall Finishes, Wall Lighting, Walkways',
              'Porch: Ceiling Finish, Fans, Lighting, Flooring/Decking Finish, Railings/Handrail, Stair Tread Finish',
              'Confirm timeline and sequence of installations',
            ],
          },
          {
            text: 'Field Drawing Updates',
            sub: [
              'Update/mark field drawings with final selections',
              'Ensure clarity for subcontractor execution',
            ],
          },
          {
            text: 'Site Access & Communication',
            sub: [
              'Verify construction sign is posted',
              'Confirm job box is stocked with QR code sheet and selections packet',
              'Review communication protocols for the finish stage',
            ],
          },
          {
            text: 'Q&A and Next Steps',
            sub: [
              'Address any questions from the customer',
              'Review expected completion window',
              'Note any open selections or action items',
            ],
          },
        ],
      },
    ],
    nps: true,
  },
  'CF1.a': {
    header: 'CF1.a — Internal Sub Meeting',
    subheader: 'Phase 9: Construction Finish · Internal',
    sections: [
      {
        title: 'ATTENDANCE',
        items: [
          'Superintendent',
          'Subcontractors',
        ],
      },
      {
        title: 'AGENDA',
        numbered: true,
        items: [
          'Review finishes with subs that will be performing the installs',
          'Review the BT schedule with subs, highlighting the next steps in the construction journey, along with the selections packet, kitchen layout, and bathroom layout',
          'Update field drawings to reflect all finishes that will be installed',
        ],
      },
    ],
  },
  CR2e: {
    header: 'CR2e — Release to Hang to Customer',
    subheader: 'Phase 8: Construction Rough In · Email',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Project Manager',
          'Cc: Superintendent',
          'Subject: Your Project Is Ready for Drywall – Approved to Hang!',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Hi [Customer Name],',
          'Congratulations! Your project has officially passed the insulation inspection, and we are released to hang drywall. Everything is moving along nicely and right on track.',
          'The next step in your project will be to schedule the Finishes Meeting.',
          'This process ensures that the:',
        ],
      },
      {
        items: [
          'Schedule and selections packet are fully reviewed',
          'All field drawings and finishes (including kitchen and bathroom layouts) are verified',
          'Installation details are confirmed prior to moving forward',
        ],
      },
      {
        items: [
          'Are you available during these timeslots?',
          'Date and Time 1',
          'Date and Time 2',
          'Date and Time 3',
          'To help us continue delivering a top-tier construction experience, we\'d appreciate it if you could take a minute to answer our Construction Phase Feedback Survey. Your input goes a long way to help us improve!',
          'CUSTOMER JOURNEY SURVEY HANDOUT',
          'If you have any questions or concerns at this stage of your project, please don\'t hesitate to reach out — I\'m here to support you every step of the way.',
          'Thank you,',
          '[Project Manager Name]',
          'Phone: [Your Number]',
          'Email: [Your Email]',
        ],
      },
    ],
  },
  CR1m: {
    header: 'CR1m — Rough In with Customer',
    subheader: 'Phase 8: Construction Rough In · Meeting',
    sections: [
      {
        title: 'ATTENDANCE',
        items: [
          'Superintendent',
          'Customer',
        ],
      },
      {
        title: 'MEETING FLOW',
        numbered: true,
        items: [
          {
            text: 'Welcome & Purpose',
            sub: [
              'Set expectations for the rough-in phase',
              'Confirm this meeting occurs prior to rough-in electrical inspection',
            ],
          },
          {
            text: 'BuilderTrend Schedule Review',
            sub: [
              'Review current schedule',
              'Highlight next milestones leading into inspection and drywall phases',
            ],
          },
          {
            text: 'Field Plan & Installation Walkthrough',
            sub: [
              'Review permitted plans and marked-up field set',
              'Confirm proper installation of: Electrical layout (Are we doing any dimmers?), Kitchen layout, Bathroom lighting and vanity, Plumbing, HVAC systems',
            ],
          },
          {
            text: 'Neighbor Considerations',
            sub: [
              'Address any known concerns raised by homeowner',
              'Determine if direct communication from CASK is necessary',
            ],
          },
          {
            text: 'Job Site Signage & Plan Access',
            sub: [
              'Confirm construction sign is posted and visible',
              'Confirm job box is in place',
              'Verify QR code sheet is available and leads to most updated plans',
            ],
          },
          {
            text: 'Q&A and Next Steps',
            sub: [
              'Answer customer questions regarding installations or inspections',
              'Confirm timing of inspection and drywall start',
              'Note any follow-up tasks or adjustments needed',
            ],
          },
        ],
      },
    ],
    nps: true,
  },
  'CR1.a': {
    header: 'CR1.a — Internal Sub Meeting',
    subheader: 'Phase 8: Construction Rough In · Internal',
    sections: [
      {
        title: 'ATTENDANCE',
        items: [
          'Superintendent',
          'Subcontractors',
        ],
      },
      {
        title: 'AGENDA',
        numbered: true,
        items: [
          'Walk subs through the scope of work and updated field set of plans',
          'Review the BT schedule with subs, highlighting the next steps in the construction journey',
          'Review permitted set of plans and marked-up field plans with subs, focusing on installation of electrical layout, kitchen layout, bathroom lighting and vanity, plumbing, and HVAC',
        ],
      },
    ],
  },
  PD4m: {
    header: 'PD4m — 75% Floor Plan with Customer',
    subheader: 'Phase 2: Pre-Construction Design · Meeting',
    sections: [
      {
        title: 'MEP LAYOUT — ELECTRICAL LAYOUT',
        items: [
          '1. Outdoor lighting if necessary',
          '2. Indoor lighting options',
        ],
      },
      {
        title: 'MEP LAYOUT — PLUMBING',
        items: [
          '1. Locate hose bibs',
          '2. Location of water heater',
          '3. Tub or shower selection',
          '4. Location of shower valve (preferred not on exterior wall)',
        ],
      },
      {
        title: 'MEP LAYOUT — MECHANICAL',
        items: [
          '1. Location of air handler',
          '2. Location of condenser',
          '3. Determine if range hood exhaust is vented to outside',
        ],
      },
      {
        title: 'ELEVATIONS',
        items: [
          'Confirm Window Placement',
          'Garage door height – confirm at 7 ft',
        ],
      },
    ],
    nps: true,
  },
}

// ── Agenda modal ──────────────────────────────────────────────────────────────

function AgendaModal({ code, onClose }: { code: string; onClose: () => void }) {
  const agenda = AGENDAS[code]

  const close = useCallback(onClose, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  if (!agenda) return null

  function renderItem(item: string | AgendaItem, index: number, numbered?: boolean) {
    const isObj = typeof item === 'object'
    const text = isObj ? item.text : item
    const sub = isObj ? item.sub : undefined
    const marker = numbered ? `${index + 1}.` : '•'

    return (
      <li key={index} style={{ marginBottom: sub?.length ? 8 : 5, listStyle: 'none' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: 'var(--red, #c8311a)', fontWeight: 600, fontSize: 12, flexShrink: 0, minWidth: 16 }}>{marker}</span>
          <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{text}</span>
        </div>
        {sub?.length ? (
          <ul style={{ margin: '5px 0 0 24px', padding: 0 }}>
            {sub.map((s, si) => (
              <li key={si} style={{ listStyle: 'none', marginBottom: 3, display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--text3)', fontSize: 12, flexShrink: 0 }}>›</span>
                <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{s}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    )
  }

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'overlayIn 0.2s ease forwards',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 600, maxHeight: '80vh',
          background: 'var(--surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalIn 0.25s ease forwards',
        }}
      >
        {/* Modal header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-instrument-serif, Georgia, serif)',
                fontSize: 18, fontWeight: 400,
                color: 'var(--text)', margin: 0, lineHeight: 1.3, letterSpacing: '-0.2px',
              }}
            >
              {agenda.header}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 0' }}>
              {agenda.subheader}
            </p>
          </div>
          <button
            onClick={close}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1, fontFamily: 'inherit', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {agenda.sections.map((section, si) => (
            <div key={si} style={{ marginBottom: 22 }}>
              {section.title && (
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.3px', textTransform: 'uppercase', color: 'var(--red, #c8311a)', marginBottom: 10 }}>
                  {section.title}
                </div>
              )}
              <ul style={{ margin: 0, padding: 0 }}>
                {section.items.map((item, ii) => renderItem(item, ii, section.numbered))}
              </ul>
            </div>
          ))}

          {/* NPS section */}
          {agenda.nps && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 20px' }} />
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.3px', textTransform: 'uppercase', color: 'var(--red, #c8311a)', marginBottom: 10 }}>
                NPS SURVEY
              </div>
              <ul style={{ margin: 0, padding: 0 }}>
                {NPS_QUESTIONS.map((q, qi) => (
                  <li key={qi} style={{ listStyle: 'none', marginBottom: 5, display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--red, #c8311a)', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>•</span>
                    <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{q}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            CASK Construction · caskconstruction.com · 727-201-2551
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Phase accordion ───────────────────────────────────────────────────────────

function PhaseBlock({ phase, onViewAgenda }: { phase: Phase; onViewAgenda: (code: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-[10px] overflow-hidden"
      style={{ border: `1px solid ${phase.borderColor}` }}
    >
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        style={{ background: phase.bgColor, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {/* Phase number badge */}
        <div
          className="flex items-center justify-center rounded-full text-[11px] font-bold text-white shrink-0"
          style={{ width: 26, height: 26, background: phase.color }}
        >
          {phase.number}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold tracking-[-0.1px]" style={{ color: phase.color }}>
            Phase {phase.number} — {phase.label}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: phase.color, opacity: 0.65 }}>
            Meetings {phase.startIndex}–{phase.startIndex + phase.meetings.length - 1}
          </div>
        </div>

        {/* Count chip */}
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
          style={{ background: phase.color, color: '#fff', opacity: 0.85 }}
        >
          {phase.meetings.length} meetings
        </span>

        {/* Chevron */}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={phase.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.7 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Meeting rows */}
      {open && (
        <div style={{ background: 'var(--white)', borderTop: `1px solid ${phase.borderColor}` }}>
          {phase.note && (
            <div
              className="flex items-start gap-2 px-5 py-3 text-[12px]"
              style={{
                background: phase.bgColor,
                borderBottom: `1px solid ${phase.borderColor}`,
                color: phase.color,
                lineHeight: 1.5,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="9" y1="6" x2="9" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="9" cy="12" r="0.8" fill="currentColor"/>
              </svg>
              <span style={{ opacity: 0.85 }}>{phase.note}</span>
            </div>
          )}
          {phase.meetings.map((item, i) => {
            const num = phase.startIndex + i
            const isObj = typeof item === 'object'
            const title = isObj ? item.title : item
            const code = isObj ? item.code : null
            const type = isObj ? item.type : null

            const isEmail = type === 'email'
            const isInternal = type === 'internal'

            return (
              <div
                key={`${num}-${code ?? i}`}
                className="flex items-center gap-3 py-2.5"
                style={{
                  borderBottom: i < phase.meetings.length - 1 ? '1px solid var(--border)' : 'none',
                  paddingLeft: isEmail || isInternal ? 28 : 20,
                  paddingRight: 20,
                  background: isEmail || isInternal ? 'var(--surface2, #fafafa)' : 'var(--white)',
                  opacity: isEmail || isInternal ? 0.85 : 1,
                }}
              >
                {/* Number — hide for email/internal rows, show type icon instead */}
                {isEmail ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <polyline points="2,4 12,13 22,4" />
                  </svg>
                ) : isInternal ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                ) : (
                  <div className="text-[11px] font-semibold w-6 text-center shrink-0" style={{ color: 'var(--text3)' }}>
                    {num}
                  </div>
                )}

                {/* Code */}
                {code && (
                  <span
                    className="text-[10px] font-bold tracking-[0.4px] shrink-0"
                    style={{ color: isEmail ? '#d97706' : isInternal ? '#64748b' : phase.color, opacity: 0.75, minWidth: 36 }}
                  >
                    {code}
                  </span>
                )}

                {/* Title */}
                <span
                  className="flex-1 text-[13px]"
                  style={{
                    color: isEmail || isInternal ? 'var(--text2)' : 'var(--text)',
                    fontWeight: isEmail || isInternal ? 400 : 500,
                    fontStyle: isEmail || isInternal ? 'italic' : 'normal',
                  }}
                >
                  {title}
                </span>

                {/* Type chip */}
                {isEmail && (
                  <span
                    className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#fef3c7', color: '#92400e' }}
                    title="Automated email template"
                  >
                    Auto Email
                  </span>
                )}
                {isInternal && (
                  <span
                    className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#f1f5f9', color: '#475569' }}
                    title="Internal reference document"
                  >
                    Internal
                  </span>
                )}

                {/* M / E / P badge */}
                {type && (
                  <span
                    className="shrink-0 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: isEmail ? '#fef3c7' : isInternal ? '#f1f5f9' : '#dbeafe',
                      color: isEmail ? '#92400e' : isInternal ? '#475569' : '#1d4ed8',
                    }}
                    title={isEmail ? 'Automated email template' : isInternal ? 'Internal reference document' : 'Meeting — has agenda'}
                  >
                    {isEmail ? 'E' : isInternal ? 'P' : 'M'}
                  </span>
                )}

                {/* View Email button — email templates with content */}
                {isEmail && (
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-[5px] transition-opacity"
                    style={{
                      background: '#fef3c7',
                      color: '#92400e',
                      border: '1px solid #fde68a',
                      cursor: code && AGENDAS[code] ? 'pointer' : 'default',
                      fontFamily: 'inherit',
                      opacity: code && AGENDAS[code] ? 1 : 0.4,
                    }}
                    onClick={() => { if (code && AGENDAS[code]) onViewAgenda(code) }}
                    onMouseEnter={e => { if (code && AGENDAS[code]) e.currentTarget.style.opacity = '0.75' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = code && AGENDAS[code] ? '1' : '0.4' }}
                  >
                    View Email
                  </button>
                )}

                {/* View File button — internal docs */}
                {isInternal && (
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-[5px] transition-opacity"
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      cursor: code && AGENDAS[code] ? 'pointer' : 'default',
                      fontFamily: 'inherit',
                      opacity: code && AGENDAS[code] ? 1 : 0.4,
                    }}
                    onClick={() => { if (code && AGENDAS[code]) onViewAgenda(code) }}
                    onMouseEnter={e => { if (code && AGENDAS[code]) e.currentTarget.style.opacity = '0.75' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = code && AGENDAS[code] ? '1' : '0.4' }}
                  >
                    View File
                  </button>
                )}

                {/* Action button — meetings only */}
                {!isEmail && !isInternal && (
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-[5px] transition-opacity"
                    style={{
                      background: phase.bgColor,
                      color: phase.color,
                      border: `1px solid ${phase.borderColor}`,
                      cursor: code && AGENDAS[code] ? 'pointer' : 'default',
                      fontFamily: 'inherit',
                      opacity: code && AGENDAS[code] ? 1 : 0.4,
                    }}
                    onClick={() => { if (code && AGENDAS[code]) onViewAgenda(code) }}
                    onMouseEnter={e => { if (code && AGENDAS[code]) e.currentTarget.style.opacity = '0.75' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = code && AGENDAS[code] ? '1' : '0.4' }}
                  >
                    View Agenda
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientTemplatesPage() {
  const [activeAgenda, setActiveAgenda] = useState<string | null>(null)

  return (
    <>
      {activeAgenda && <AgendaModal code={activeAgenda} onClose={() => setActiveAgenda(null)} />}
      <TopBar title="Client Templates" subtitle="Customer Journey" />

      <div className="flex-1 overflow-y-auto animate-page-in">
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '36px 32px 80px' }}>

          {/* Header */}
          <div
            className="flex items-start justify-between gap-4 mb-7"
          >
            <div>
              <h1
                className="font-serif text-[30px] font-normal tracking-[-0.4px] leading-[1.15]"
                style={{ color: 'var(--text)', margin: '0 0 6px' }}
              >
                Client Templates
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0, maxWidth: 520 }}>
                Standard workflow for every CASK Construction client — 56 items from first contact to closeout
              </p>
            </div>

            <Link
              href="/customers/new"
              className="no-underline shrink-0"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                background: 'var(--red, #c8311a)',
                padding: '9px 16px',
                borderRadius: 8,
                whiteSpace: 'nowrap',
                marginTop: 4,
              }}
            >
              + New Client
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-5 gap-3 mb-7">
            {STATS.map(s => (
              <div
                key={s.label}
                className="rounded-[10px] p-4 text-center"
                style={{ background: 'var(--white)', border: '1px solid var(--border)' }}
              >
                <div
                  className="text-[22px] font-semibold tracking-[-0.5px] mb-0.5"
                  style={{ color: 'var(--text)' }}
                >
                  {s.value}
                </div>
                <div className="text-[11px] font-medium" style={{ color: 'var(--text3)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Phase accordions */}
          <div className="flex flex-col gap-3 mb-10">
            {PHASES.map(phase => (
              <PhaseBlock key={phase.number} phase={phase} onViewAgenda={setActiveAgenda} />
            ))}
          </div>

          {/* CTA */}
          <Link
            href="/customers/new"
            className="no-underline flex items-center justify-center gap-2 w-full py-4 rounded-[10px] text-[15px] font-semibold text-white transition-opacity"
            style={{
              background: 'var(--red, #c8311a)',
              boxShadow: '0 4px 16px rgba(200,49,26,0.25)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          >
            Duplicate for New Client →
          </Link>

        </div>
      </div>
    </>
  )
}
