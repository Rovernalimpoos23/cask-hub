// Shared agenda/email content for Client Templates and Client Journey pages

export interface AgendaItem {
  text: string
  sub?: string[]
}

export interface AgendaSection {
  title?: string
  numbered?: boolean
  items: (string | AgendaItem)[]
}

export interface AgendaContent {
  header: string
  subheader: string
  sections: AgendaSection[]
  nps?: boolean
}

export const NPS_QUESTIONS = [
  'How happy are you on a scale of 1-10?',
  'How do you feel our communication has been?',
  'How is the pace of the construction journey going?',
  'What could we improve or what made your journey enjoyable?',
]

export const AGENDAS: Record<string, AgendaContent> = {
  PS1e: {
    header: 'PS1e — Selections Kick-off to Customer',
    subheader: 'Phase 4: Pre-Construction Selections · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Selections Manager',
          'Cc: Project Manager',
          'Subject: Kicking Off Your Selections Process',
          'To: [Customer First Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Hi [Customer First Name],',
          'We\'re excited to begin the selections process for your new ADU! The goal of this stage is to have all your fixtures and finishes chosen before construction begins. This helps keep everything on schedule, within budget, and prevents unexpected delays.',
          'To help us prepare for your first selections meeting, please complete the Customer Selections Questionnaire by [Due Date]. This questionnaire supports the 3D rendering we\'ll review together and covers:',
        ],
      },
      {
        title: 'QUESTIONNAIRE COVERS',
        items: [
          'Your level of involvement in the selections process',
          'Preferred color selections',
          'Intended use of the space',
          'Any special requests for the 3D rendering',
          'Option to upload design inspiration',
        ],
      },
      {
        title: 'AT OUR FIRST MEETING, WE\'LL',
        items: [
          'Review the 3D rendering of your project',
          'Explore your design style and vision',
          'Discuss how you plan to use the space',
        ],
      },
      {
        title: 'THE SELECTIONS PROCESS',
        numbered: true,
        items: [
          { text: 'Introductory Meeting – View your custom 3D rendering and introduce the design process', sub: [] },
          { text: 'Sample Time! – Kitchen layout, backsplash/bathroom tile, flooring, and more', sub: [] },
          { text: 'Final Review Meeting – Review all selections with your Project Manager to confirm details', sub: [] },
        ],
      },
      {
        title: 'SCHEDULING',
        items: [
          'We\'d love to have the first meeting at the Cask office (900 16th Street North). Would one of the following options work for you?',
          '[Date Option #1]',
          '[Date Option #2]',
          '[Date Option #3]',
          'If none of these dates work, please share some alternatives and we\'ll do our best to coordinate.',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Looking forward to getting started!',
        ],
      },
    ],
  },
  PS3e: {
    header: 'PS3e — Post 1st Selections Meeting to Customer',
    subheader: 'Phase 4: Pre-Construction Selections · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Selections Manager',
          'Cc: Project Manager',
          'Subject: Post 1st Selections Meeting Recap & Next Steps',
          'To: [Customer Name(s)]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'It was such a pleasure meeting you for your first selections session! Your choices are really starting to bring the design together, and we\'re excited to see your project taking shape.',
        ],
      },
      {
        title: 'PENDING SELECTIONS',
        items: [
          'The following items are still to be determined. You can share links, send details by email, or simply bring your choices to our next meeting:',
          '[Insert Pending Selections List]',
        ],
      },
      {
        title: 'CLARIFICATIONS',
        items: [
          '[Insert any specific clarification questions from meeting]',
        ],
      },
      {
        title: 'VENDOR INFORMATION',
        items: [
          'We\'ve included contact information for our trusted vendor partners, who are aware of your project and ready to assist if needed.',
          { text: 'Appliances', sub: ['Contact: [Vendor Contact Name]', 'Email: [Vendor Email]', 'Phone: [Vendor Phone]'] },
          { text: 'Counters', sub: ['Contact: [Vendor Contact Name]', 'Email: [Vendor Email]', 'Phone: [Vendor Phone]'] },
        ],
      },
      {
        title: 'NEXT STEPS',
        items: [
          'We\'d like to schedule your 2nd selections meeting in 1–2 weeks. Please use the booking link below to choose a time that works best for you:',
          '[Insert Booking Link]',
          'As always, if any questions come up before then, don\'t hesitate to reach out—I\'m happy to help!',
        ],
      },
    ],
  },
  PS5e: {
    header: 'PS5e — Post 2nd Selections Meeting to Customer',
    subheader: 'Phase 4: Pre-Construction Selections · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Selections Manager',
          'Cc: Project Manager',
          'Subject: Post 2nd Selections Meeting Recap & Next Steps',
          'To: [Customer Name(s)]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Thank you for another productive selections meeting! It\'s exciting to see your choices continue to bring the design together. We\'re making great progress toward finalizing everything.',
          'I\'ll be working on [insert follow-up task, e.g., kitchen design updates, vanity sizing verification, etc.] and will send those details for your review as soon as they are ready.',
        ],
      },
      {
        title: 'PENDING SELECTIONS',
        items: [
          'Here are the items still to be determined. You can send me links, email your choices, or bring them with you to our next meeting:',
          '[Insert Pending Selections List]',
        ],
      },
      {
        title: 'OWNER TO PROVIDE',
        items: [
          'These are the selections or items you\'ll be sourcing directly:',
          '[Insert Owner-Provided Selections List]',
        ],
      },
      {
        title: 'VENDOR INFORMATION',
        items: [
          { text: 'Appliances', sub: ['Contact: [Vendor Contact Name]', 'Email: [Vendor Email]', 'Phone: [Vendor Phone]'] },
          '[Add additional vendors if applicable]',
        ],
      },
      {
        title: 'NEXT STEPS',
        items: [
          'Our final review meeting is coming up in 1–2 weeks. During this session, we\'ll go over all selections and layout details to ensure everything is accurate before moving forward. Please use the link below to book a time that works best for you:',
          '[Insert Booking Link]',
          'If you have any questions or think of changes in the meantime, don\'t hesitate to reach out—I\'m happy to help!',
        ],
      },
    ],
  },
  PS9e: {
    header: 'PS9e — Post 4th Selections Meeting to Customer',
    subheader: 'Phase 4: Pre-Construction Selections · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Selections Manager',
          'Cc: Project Manager',
          'Subject: Post 4th Selections Meeting Recap & Final Steps',
          'To: [Customer Name(s)]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Congratulations—we\'ve reached the final step of your selections process! Thank you for all your time and input as we\'ve worked together to finalize the details of your project.',
        ],
      },
      {
        title: 'RECAP OF 4TH MEETING',
        items: [
          '[Insert summary of decisions finalized]',
          '[Insert any outstanding items or clarifications]',
        ],
      },
      {
        title: 'CUSTOMER HOMEWORK',
        items: [
          'Complete Section 3 (miscellaneous selections) by [insert due date]',
          'Review Buildertrend selections guide (link provided)',
          'Finalize any open follow-up items with due dates',
        ],
      },
      {
        title: 'NEXT STEPS',
        items: [
          'This completes the selections phase of your project. With your approvals in place, we\'ll now transition to preparing for the next stage of construction.',
          'Thank you again for your partnership—your design is now ready to come to life!',
        ],
      },
    ],
  },
  PB1e: {
    header: 'PB1e — Sewage and Water Inspection to Customer',
    subheader: 'Phase 5: Pre-Construction Bid Management · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'From: [Project Manager Name]',
          'Cc: [Plumber]',
          'Subject: Upcoming Sewer & Water Inspection – Introduction and Details',
          'To: [Customer First Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'I\'d like to introduce you to A1 Southern Plumbing, who will be performing your Sewer and Water Inspection.',
          'Connie or Roger, please coordinate with the customer on scheduling the inspection.',
          '[Insert customer address and contact information]',
        ],
      },
      {
        title: 'NEXT STEPS',
        items: [
          'Plumber will arrive at your property on the scheduled date and time',
          'The inspection will review your water and sewer line layout, condition, and any potential construction obstacles',
          'We\'ll compile the inspection results and integrate them into your project\'s plumbing scope and budget',
          'Once complete, we\'ll update you on the findings and next steps',
        ],
      },
      {
        title: 'ATTACHMENT',
        items: [
          'We\'ve attached our Sewer and Water Inspection Checklist so you know exactly what will be reviewed during the inspection.',
          'Thank you,',
        ],
      },
    ],
  },
  PB3e: {
    header: 'PB3e — Congratulations Project Out to Bid',
    subheader: 'Phase 5: Pre-Construction Bid Management · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Project Manager',
          'Subject: Congratulations – Your Project is Now Out to Bid!',
          'To: [Customer Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Congratulations! Your project has officially been sent out to bid. This is a major milestone, and it means subcontractors are now reviewing your plans and preparing their pricing.',
        ],
      },
      {
        title: 'WHAT THIS MEANS FOR YOU',
        items: [
          'Subcontractors are reviewing your project scope in detail',
          'We\'ll be gathering competitive bids to ensure the best value and quality',
          'This process brings us one step closer to finalizing your construction budget and schedule',
        ],
      },
      {
        title: 'NEXT STEPS',
        items: [
          'Once bids are received and reviewed, you\'ll receive your 95% budget update',
          'We\'ll continue communicating proactively to keep you informed and confident as we move forward',
          'In the meantime, please take a moment to share your feedback with us through our CUSTOMER JOURNEY SURVEY HANDOUT',
          'Thank you again for your partnership—we\'re excited to move into this next stage with you.',
        ],
      },
    ],
  },
  PB4e: {
    header: 'PB4e — 95% Budget Update to Customer',
    subheader: 'Phase 5: Pre-Construction Bid Management · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Project Manager',
          'Cc: Design Manager',
          'Subject: Your 95% Project Budget Update',
          'To: [Customer Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'As we move closer to the finish line, I\'m excited to share your 95% budget update. This version reflects real subcontractor pricing based on the plans submitted for permit, along with utility confirmations from our earlier design coordination.',
        ],
      },
      {
        title: 'WHAT\'S INCLUDED IN THIS UPDATE',
        items: [
          'Subcontractor pricing aligned with your project plans',
          'Utility confirmation costs carried over from the 50% design stage',
          'A clear view of allowances for final materials selections',
          'Noted items that may still be pending, such as special scope requests',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Our goal is to make sure you have the most accurate picture of your project\'s financials before we finalize the budget. This is the time to confirm any last selections or scope requests so they can be accounted for before moving ahead.',
          'If you\'d like to review this update together, I\'d be happy to schedule a call or walk-through with you.',
          'Thank you for your continued input and collaboration—your project is almost ready for the exciting next stage!',
        ],
      },
    ],
  },
  PB6e: {
    header: 'PB6e — Contract Approval to Customer',
    subheader: 'Phase 5: Pre-Construction Bid Management · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'To: Customer',
          'Cc: Accounting Manager, VP Operations',
          'Subject: Your Construction Contract is Officially Executed!',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'We\'re excited to share that your construction contract has been officially executed—this is a huge milestone and marks the true starting point for your project! Please find the executed contract attached for your records.',
          'I\'d also like to introduce you to Lamont Gilyot, our Accounting Manager (cc\'d here at l.gilyot@caskconstruction.com). Lamont will be your point of contact for anything related to billing, deposits, and payment coordination throughout the project.',
        ],
      },
      {
        title: 'NEXT STEPS',
        items: [
          { text: 'Deposit:', sub: ['Lamont and our accounting team will process the initial 25% deposit shortly.'] },
          { text: 'Tentative Start Date:', sub: ['We are targeting [Insert Tentative Start Date] to begin on-site activities.'] },
        ],
      },
      {
        title: 'NEXT MILESTONE',
        items: [
          'Your Project Kick-Off Meeting is coming up! During this meeting, we\'ll align on goals, review the schedule, and finalize initial action items.',
          'We\'re committed to making your ADU build seamless and enjoyable, and we can\'t wait to see your dream space come to life.',
        ],
      },
      {
        title: 'NPS SURVEY',
        items: [
          'In our effort to continuously improve your experience with CASK Construction, please share your valuable feedback through our quick Net Promoter Score (NPS) survey linked below:',
          'CUSTOMER JOURNEY SURVEY HANDOUT',
          'Thank you again for choosing CASK Construction—let\'s build something incredible together!',
        ],
      },
    ],
    nps: true,
  },
  PP5e: {
    header: 'PP5e — Permit Approval',
    subheader: 'Phase 3: Pre-Construction Permit · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Subject: CASK Construction – Permit Approved – Let\'s Celebrate!',
          'From: [Project Manager]',
          'To: [Customer Name]',
          'Cc: [VP Operation]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Hi [Owner Name],',
          'Fantastic news! We\'re thrilled to announce that your ADU permit has officially been approved by the City of St. Pete! This is a significant milestone, and we\'re excited to move forward with bringing your ADU vision to life.',
        ],
      },
      {
        title: 'NEXT STEPS',
        items: [
          'Contract Review: We\'ll coordinate with you soon to review the final construction contract, ensuring everything aligns with your expectations and requirements.',
          'Ground Breaking: Following contract execution, we\'ll schedule the groundbreaking ceremony—marking the exciting start of construction on your project.',
        ],
      },
      {
        title: 'NPS SURVEY',
        items: [
          'We\'re committed to making your ADU build seamless and enjoyable, and we can\'t wait to see your dream space come to life.',
          'In efforts to continuously improve your experience with CASK Construction, please provide your valuable feedback through our quick Net Promoter Score (NPS) survey linked below:',
          'CUSTOMER JOURNEY SURVEY HANDOUT',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Thank you again for choosing CASK Construction. Let\'s build something incredible together!',
          'Warm regards,',
          'Project Manager',
        ],
      },
    ],
  },
  PP4e: {
    header: 'PP4e — 2nd RFC Resubmittal to Customer',
    subheader: 'Phase 3: Pre-Construction Permit · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Permit Tech',
          'Cc: Project Manager',
          'Subject: CASK Construction – Plans Resubmitted (2nd Round)',
          'To: [Owner Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Dear [Owner Name],',
          'We\'re pleased to share that the updated plans addressing the city\'s second round of comments have now been resubmitted for review.',
        ],
      },
      {
        title: "WHAT'S NEXT",
        items: [
          'The city will review these updated drawings',
          'If no further comments are raised, we\'ll be moving into the approval stage',
          'If additional feedback is received, we\'ll work with you and our design partners to address it quickly',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Thank you again for your patience and collaboration—we\'re nearly at the approval milestone!',
        ],
      },
    ],
  },
  PP3e: {
    header: 'PP3e — 2nd RFC to Customer',
    subheader: 'Phase 3: Pre-Construction Permit · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Permit Tech',
          'Cc: Project Manager',
          'Subject: CASK Construction – City Comments (2nd Round)',
          'To: [Owner Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Dear [Owner Name],',
          'We\'ve received the city\'s second round of comments regarding your permit submission. While additional feedback is common, it means we\'re making steady progress toward final approval.',
        ],
      },
      {
        title: 'WHAT YOU NEED TO KNOW',
        items: [
          'The city has provided the following updates/questions: [Insert any specific comments here that require customer awareness or input]',
          'Drawings have been sent to our architect/designer for review and revisions as needed',
        ],
      },
      {
        title: 'NEXT STEPS',
        items: [
          'Our team will address the city\'s comments promptly',
          'Revised plans will be resubmitted for continued review',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'We\'re getting closer to the finish line, and your continued input is greatly appreciated. Please reach out with any questions or clarifications you\'d like on the city\'s comments.',
          'Best regards,',
        ],
      },
    ],
  },
  PP2e: {
    header: 'PP2e — 1st RFC Resubmittal to Customer',
    subheader: 'Phase 3: Pre-Construction Permit · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Permit Tech',
          'Cc: Project Manager',
          'Subject: CASK Construction – Plans Resubmitted to City',
          'To: [Owner Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Dear [Owner Name],',
          'Great news! We\'ve completed the necessary updates to your drawings and have officially resubmitted them to the city for review.',
          'This is an important step forward in the permitting process, and we\'ll continue to keep you updated as we receive additional feedback.',
        ],
      },
      {
        title: "WHAT'S NEXT",
        items: [
          'The city will review the revised plans',
          'If further comments are required, we\'ll share them with you right away',
          'Otherwise, we\'ll move closer to final approval',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Thank you again for your patience and partnership as we work through this process together.',
        ],
      },
    ],
  },
  PP1e: {
    header: 'PP1e — 1st RFC to Customer',
    subheader: 'Phase 3: Pre-Construction Permit · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'To: Customer',
          'Cc: Design Tech',
          'Subject: CASK Construction – City Comments Received',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Dear [Owner Name],',
          'We\'ve received the first round of comments from the city regarding your ADU permit submission. This is a normal part of the permitting process, and we\'re one step closer to approval!',
        ],
      },
      {
        title: 'WHAT YOU NEED TO KNOW',
        items: [
          'The city has provided feedback that requires some updates to the submitted drawings.',
          '[Insert any specific comments or questions here that require the customer\'s input or decision.]',
        ],
      },
      {
        title: 'NEXT STEPS',
        numbered: true,
        items: [
          {
            text: 'Plan Revisions',
            sub: [
              'We\'ve sent the city\'s comments to our architect/designer, who is now working on the necessary revisions.',
              'Once updated, the revised plans will be resubmitted to the city for the next round of review.',
            ],
          },
          {
            text: 'Timeline',
            sub: [
              'As a reminder, it\'s common for the city to request revisions during the first review. This back-and-forth is expected and helps ensure everything is in order for final approval.',
              'We\'ll continue to keep you updated as we progress through the permitting stages.',
            ],
          },
          {
            text: 'Survey',
            sub: [
              'In efforts to continuously improve your experience with CASK Construction, I am including the below link to collect your Net Promotor Score (NPS). This quick 1-2 minute survey is sent to CASK Construction management for review and will serve as a guiding light to ensure your needs are being met.',
              'CUSTOMER JOURNEY SURVEY HANDOUT',
            ],
          },
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Thank you again for your continued partnership and trust in CASK Construction. If you have any questions or would like to discuss the city\'s comments in more detail, feel free to reach out anytime. In the meantime, congratulations to be closer to the final approval!',
        ],
      },
    ],
  },
  PD8e: {
    header: 'PD8e — Permit Submission Confirmation',
    subheader: 'Phase 2: Pre-Construction Design · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Subject: CASK Construction – Permit Submitted!',
          'To: [Owner Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Dear [Owner Name],',
          'Congratulations, your ADU project was submitted for permit! Attached are the drawings that were submitted for review for your records.',
        ],
      },
      {
        title: 'GENERAL INFORMATION REGARDING CITY OF ST PETE PERMITTING',
        numbered: true,
        items: [
          {
            text: 'All ADU projects require Building and Zoning department approval. If your project is in a flood zone, permitting will also require FEMA department approval. If your project is located at a historic address, permitting will also require Historic department approval (prior to regular Building and Zoning department approval).',
            sub: [],
          },
          {
            text: 'If your project requires a demolition permit, the city requires us to breakout just the site plan and include a utility verification form (ensuring no utilities are connected to the structure we are going to demo) and submit a separate permit application for the demolition.',
            sub: [
              'Just before construction, CASK Construction will disconnect the electrical and plumbing that is running to the existing garage prior to demo.',
            ],
          },
          {
            text: 'The city staff will route the permit to the plan reviewers, one in each respected department outlined above. Once reviewed they will route it back to us. If approved (which rarely happens 1st round), we will be good to start construction as far as the city is concerned. If any of the described departments have comments returned to us for correction, we will need to revise the plans and resubmit for a 2nd round.',
            sub: [],
          },
          {
            text: 'On average, ADU permitting can range from 2.5–4 months. Actual time dependent on factors such as city responsiveness, project scope (flood, historic, demo, etc), environmental challenges (storms), and time allowed for responding to City comments.',
            sub: [],
          },
        ],
      },
      {
        title: 'NEXT STEPS',
        numbered: true,
        items: [
          {
            text: 'Design Selections',
            sub: [
              'Our in-house interior specialist will reach out to schedule your first design selections meeting.',
              'We plan to also review a 3D rendering of your design to better help you visualize the space and will have that ready for your first selections meeting.',
            ],
          },
          {
            text: 'Bid Management',
            sub: [
              'We will send your customized drawings to our network of specialty subcontractors to start gathering quotes needed to be incorporated into your final construction budget.',
            ],
          },
          {
            text: 'In efforts to continuously improve your experience with CASK Construction, I am including the below link to collect your Net Promotor Score (NPS). This quick 1-2 minute survey is sent to CASK Construction management for review and will serve as a guiding light to ensure your needs are being met.',
            sub: ['CUSTOMER JOURNEY SURVEY HANDOUT'],
          },
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Approved permit and an executed construction contract is required prior to CASK Construction starting construction on your project.',
          'CASK Construction will keep you updated during your permitting process. In the meantime, please do not hesitate to reach out anytime for updates regarding your permitting status or progress.',
          'Thank you for trusting us with your project! Congratulations again on going in for permit!',
          'Best regards,',
          '[Your Name]',
        ],
      },
    ],
  },
  PD7e: {
    header: 'PD7e — 95% Drawing to Customer',
    subheader: 'Phase 2: Pre-Construction Design · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Subject: CASK Construction – 95% Drawing Set for Your Review',
          'To: [Owner Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Dear [Owner Name],',
          'Great news!',
          'We have received the 95% set of plans from the engineer, which are attached for your review. These drawings reflect the changes we discussed in our previous meetings and include essential updates based on your feedback and requests.',
        ],
      },
      {
        title: 'KEY AREAS FOR REVIEW',
        numbered: true,
        items: [
          { text: 'General Layout:', sub: ['Please review the overall spatial arrangement and flow of the updated design.'] },
          { text: 'Dimensions and Specifications:', sub: ['Confirm that all dimensions and specifications continue to meet your requirements.'] },
          { text: 'Alignment with Project Goals:', sub: ['Assess how well the updated drawings align with the project objectives we previously discussed.'] },
        ],
      },
      {
        title: 'NEXT STEPS',
        numbered: true,
        items: [
          { text: 'Once you have reviewed the drawings, please share any comments, questions, or requested changes. If these plans are satisfactory, please respond with authorization to submit for permitting.', sub: [] },
          { text: 'Your approval response will route these plans for permitting with the City of St Pete. Ideally, we have captured all of your design requests prior to submitting for permitting so we can better streamline the overall permitting process for your project.', sub: [] },
          { text: 'CASK Construction will provide another email update once your permits are submitted to the City of St Pete.', sub: [] },
          { text: 'In efforts to continuously improve your experience with CASK Construction, I am including the below link to collect your Net Promotor Score (NPS). This quick 1-2 minute survey is sent to CASK Construction management for review and will serve as a guiding light to ensure your needs are being met.', sub: ['CUSTOMER JOURNEY SURVEY HANDOUT'] },
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Very exciting! Please continue to reach out with any questions or concerns.',
          'Best regards,',
          '[Your Name]',
        ],
      },
    ],
  },
  PD6e: {
    header: 'PD6e — 75% Budget Update to Customer',
    subheader: 'Phase 2: Pre-Construction Design · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Project Manager',
          'Cc: Design Manager',
          'Subject: Your 75% Project Budget Update',
          'To: [Customer Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Dear [Customer Name],',
          'Following our recent 75% floorplan meeting and recap, I\'m providing your updated project budget. This second budget update reflects the design refinements we\'ve made since the 50% stage and ensures alignment as we approach the final design.',
        ],
      },
      {
        title: "WHAT'S INCLUDED IN THIS UPDATE",
        items: [
          'Revised budget status based on the 75% design stage',
          'Adjustments made since the previous update',
          'Key considerations as we prepare for the upcoming 95% drawings and next milestones',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Our goal is to keep you fully informed and confident as we move toward finalizing the design and preparing for permit submission.',
          'If you have any questions or would like a detailed walk-through of the numbers, please let me know—I\'ll be happy to review them with you.',
          'Thank you for your continued collaboration throughout this process.',
          'Best regards,',
          '[Project Manager Name]',
        ],
      },
    ],
  },
  PD5e: {
    header: 'PD5e — 75% Floorplan Meeting Recap to Customer',
    subheader: 'Phase 2: Pre-Construction Design · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Subject: CASK Construction 75% Floorplan Meeting Recap',
          'To: [Owner Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Dear [Owner Name],',
          'Thank you for your time and engagement during our recent 75% floorplan meeting. We covered a lot of great information relating to your future project. It\'s extremely important to CASK Construction and myself that this information is correctly documented on your building plans so that your vision is accurately transformed into reality.',
          'To ensure we are not missing anything from our 75% floorplan meeting, I have prepared the below meeting summary. Please reply all if you feel I have missed anything, or you have any questions or additional requests since our last meeting.',
        ],
      },
      {
        title: 'ACTION ITEMS',
        items: [
          '[Any deadlines or expectations]',
          '[Any items needed or requested from customer]',
        ],
      },
      {
        title: 'NEXT STEPS',
        numbered: true,
        items: [
          {
            text: 'CASK Construction will make the revisions as discussed and will email you permit ready (95%) set of plans for your review and approval within 1–2 weeks from this email.',
            sub: [],
          },
          {
            text: 'If there are any items that come up that are in addition to the revisions discussed in the 75% floorplan meeting, please respond so that we can include those items in your permit ready (95%) set of plans.',
            sub: [],
          },
          {
            text: 'In efforts to continuously improve your experience with CASK Construction, I am including the below link to collect your Net Promotor Score (NPS). This quick 1-2 minute survey is sent to CASK Construction management for review and will serve as a guiding light to ensure your needs are being met.',
            sub: ['CUSTOMER JOURNEY SURVEY HANDOUT'],
          },
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Thanks for trusting CASK Construction with your project. Please reach out anytime.',
          'Best regards,',
          '[Your Name]',
        ],
      },
    ],
  },
  PD3e: {
    header: 'PD3e — 50% Budget Update to Customer',
    subheader: 'Phase 2: Pre-Construction Design · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Sender: Project Manager',
          'Cc: Design Manager',
          'Subject: Your 50% Project Budget Update',
          'To: [Customer Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Dear [Customer Name],',
          'Following our recent 50% floorplan meeting and recap, I\'d like to share the initial budget update for your project. This update reflects the progress we\'ve made since the initial proposal and incorporates the design adjustments we\'ve reviewed together.',
        ],
      },
      {
        title: "WHAT'S INCLUDED IN THIS UPDATE",
        items: [
          'Current budget status based on the 50% design stage',
          'Alignment with the initial proposal and noted changes',
          'Key factors that may influence costs moving forward',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Our goal at this stage is to ensure full transparency and provide you with a clear picture of where the project stands financially before moving into the next phases.',
          'If you have any questions or would like us to walk through specific details, please don\'t hesitate to reach out—I\'ll be glad to go over everything with you.',
          'Thank you again for your time and input throughout this process. Your collaboration helps us keep everything on track toward the final design and budget.',
          'Best regards,',
          '[Project Manager Name]',
        ],
      },
    ],
  },
  PD2e: {
    header: 'PD2e — 50% Floorplan Meeting Recap to Customer',
    subheader: 'Phase 2: Pre-Construction Design · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Subject: CASK Construction 50% Floorplan Meeting Recap (INCLUDE PROJECT NAME)',
          'To: [Owner Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Dear [Owner Name],',
          'Thank you for your time and engagement during our recent 50% floorplan meeting. We covered a lot of great information relating to your future project. It\'s extremely important to CASK Construction and myself that this information is correctly documented on your building plans so that your vision is accurately transformed into reality.',
          'To ensure we are not missing anything from our 50% floorplan meeting, I have prepared the below meeting summary. Please reply all if you feel I have missed anything, or you have any questions or additional requests since our last meeting.',
        ],
      },
      {
        title: 'ACTION ITEMS',
        items: [
          '[Any deadlines or expectations]',
          '[Any items needed or requested from customer]',
        ],
      },
      {
        title: 'NEXT STEPS',
        numbered: true,
        items: [
          {
            text: 'Please pick from the available dates and time for our next meeting together, 75% floorplan meeting:',
            sub: [
              '[date and time #1]',
              '[date and time #2]',
              '[date and time #3]',
            ],
          },
          {
            text: 'Please respond with any items that need to be researched ahead of our meeting so I can properly prepare to avoid delaying our process together.',
            sub: [],
          },
          {
            text: 'In efforts to continuously improve your experience with CASK Construction, I am including the below link to collect your Net Promotor Score (NPS). This quick 1-2 minute survey is sent to CASK Construction management for review and will serve as a guiding light to ensure your needs are being met.',
            sub: ['CUSTOMER JOURNEY SURVEY HANDOUT'],
          },
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Thanks for trusting CASK Construction with your project. Let\'s keep this positive momentum going! Please reach out anytime!',
          'Best regards,',
          '[Your Name]',
        ],
      },
    ],
  },
  PR6e: {
    header: 'PR6e — Flag Meeting Recap to Customer',
    subheader: 'Phase 1: Pre-Construction Pre-Design · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Subject: CASK Construction Flag Meeting Recap (INCLUDE PROJECT NAME)',
          'To: Customer',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Dear Customer,',
          'Thank you for your time and engagement during our recent Flag meeting. We covered a lot of great information relating to your future project. It\'s extremely important to CASK Construction and myself that this information is correctly documented on your building plans so that your vision is accurately transformed into reality.',
          'To ensure we are not missing anything from our Flag meeting, I have prepared the below meeting summary. Please reply all if you feel I have missed anything, or you have any questions or additional requests since our last meeting.',
        ],
      },
      {
        title: 'ATTENDEES',
        items: ['[Attendee 1]', '[Attendee 2]', '[Attendee 3]'],
      },
      {
        title: 'RECAP',
        items: ['[Recap item 1]', '[Recap item 2]', '[Recap item 3]', '[Recap item 4]'],
      },
      {
        title: 'ACTION ITEMS',
        items: ['[Action item 1]', '[Action item 2]', '[Action item 3]', '[Action item 4]'],
      },
      {
        title: 'NEXT MEETING AGENDA',
        items: ['[Agenda item 1]', '[Agenda item 2]', '[Agenda item 3]', '[Agenda item 4]'],
      },
      {
        title: 'NPS SURVEY',
        items: [
          'In efforts to continuously improve your experience with CASK Construction, I am including the below link to collect your Net Promotor Score (NPS). This quick 1-2 minute survey is sent to CASK Construction management for review and will serve as a guiding light to ensure your needs are being met.',
          'CUSTOMER JOURNEY SURVEY HANDOUT',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Thanks for trusting CASK Construction with your project. Let\'s keep this positive momentum going! Please reach out anytime!',
          'Regards,',
          'The Cask Team',
        ],
      },
    ],
  },
  PR4e: {
    header: 'PR4e — Alignment Meeting Recap to Customer',
    subheader: 'Phase 1: Pre-Construction Pre-Design · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Subject: CASK Construction Kickoff Meeting Recap (INCLUDE PROJECT NAME)',
          'To: [Owner Name]',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Dear [Owner Name],',
          'Thank you for your time and engagement during our kickoff in-person meeting with you. It was great getting to meet you and getting to hear about your vision for this project! Our next in-person meeting together is the "50% floorplan meeting", outlined below.',
          'As expressed, it\'s very important for us to effectively communicate with you during the design stages and throughout the entire preconstruction journey. To help improve communication and maintain a positive experience with CASK Construction, I\'m providing the next steps of your design journey:',
        ],
      },
      {
        title: 'NEXT STEPS IN YOUR DESIGN JOURNEY',
        numbered: true,
        items: [
          {
            text: '50% floorplan meeting – our meeting is scheduled on [INPUT MEETING DATE]',
            sub: [
              'Initial site plan layout',
              'Establish exterior dimensions',
              'Wall layout',
              'Kitchen layout',
              'Confirm 75% floorplan meeting date and time',
            ],
          },
          {
            text: '50% floorplan meeting recap – emailed within 24-48 hours post 50% meeting',
            sub: [
              'What was accomplished',
              'What still needs to be discovered',
              'Separate budget update email provided by project manager',
            ],
          },
          {
            text: '75% floorplan meeting',
            sub: [
              'MEP (mechanical, electrical, plumbing) layout',
              'Exterior finishes',
              'Elevations',
              'Review 50% budget update',
            ],
          },
          {
            text: '75% floorplan meeting recap – emailed within 24-48 hours post 75% meeting',
            sub: [
              'What was accomplished',
              'What still needs to be discovered',
              'Separate budget update email provided by project manager',
            ],
          },
          {
            text: '95% design provided – emailed 1–2 weeks post 75% meeting',
            sub: [
              'Emailed 95% drawings/plans',
              'Request permission to submit plans for permitting',
              'Receive any requested changes prior to submitting for permit',
            ],
          },
          {
            text: 'Permit submission confirmation – provided within 24-hours post submitting permit',
            sub: [
              'General information regarding St Pete permitting – CASK handles your permitting process but it\'s important you still know what\'s involved with permitting and typical timeframe',
              'Outline next steps in your preconstruction journey',
            ],
          },
        ],
      },
      {
        title: 'BUDGET UPDATE TIMELINE',
        items: [
          'Throughout your preconstruction journey with us, you will receive budget updates from your dedicated project manager that will guide you from pre-construction through construction. Please expect to receive budget updates as outlined below:',
          'Initial Sales Proposal — Initial proposal provided by sales department prior to enrolling into pre-construction journey. Based on your ADU option selection on the sales questionnaire.',
          'Post 50% Design Meeting — 1st budget update provided by your project manager. Influenced by items discussed and requested at your 50% design meeting.',
          'Post 75% Design Meeting — 2nd budget update provided by your project manager. Influenced by items discussed and requested at your 75% design meeting.',
          'Permitting Comments and Post Selections (95% budget update) — 3rd budget update provided by your project manager. Influenced by applicable comments from city relating to your project permitting, and final selections decisions made. Sub numbers included in budget update.',
          'Construction Contract — Construction contract provided by your project manager at the conclusion of your pre-construction journey. Approved permitted set of drawings received. Contract execution required to start construction mobilization.',
        ],
      },
      {
        title: 'NPS SURVEY',
        items: [
          'In efforts to continuously improve your experience with CASK Construction, I am including the below link to collect your Net Promotor Score (NPS). This quick 1-2 minute survey is sent to CASK Construction management for review and will serve as a guiding light to ensure your needs are being met.',
          'PRE-CONSTRUCTION NET PROMOTER SCORE SURVEY',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Thanks for trusting CASK Construction with your project. Please don\'t hesitate to reach out with any questions or concerns.',
          'Best regards,',
          '[Your Name]',
        ],
      },
    ],
  },
  PR2e: {
    header: 'PR2e — Initial Alignment Scheduling to Customer',
    subheader: 'Phase 1: Pre-Construction Pre-Design · Email Template',
    sections: [
      {
        title: 'EMAIL DETAILS',
        items: [
          'Subject: Next Steps on Your ADU Journey – Let\'s Schedule Your Initial Alignment Meeting',
          'Sender: Sales Support',
          'To: Customer',
          'Cc: PM, Sales Manager, Design Manager',
        ],
      },
      {
        title: 'EMAIL BODY',
        items: [
          'Hi [Customer Name],',
          'Congratulations on moving forward with your ADU project—we\'re thrilled to be part of this exciting journey with you!',
          '[PM Name], your dedicated Project Manager, is looking forward to meeting you at our upcoming initial alignment meeting and to start planning your exciting project!',
          'To keep things moving smoothly, we\'d like to schedule your Initial Alignment Meeting. During this meeting, we\'ll walk through key details and objectives to ensure everything is aligned as we transition into the next phase.',
        ],
      },
      {
        title: 'SCHEDULING OPTIONS',
        items: [
          'To get started, please choose one of the following timeslots:',
          '• [Option 1: Day, Time]',
          '• [Option 2: Day, Time]',
          '• [Option 3: Day, Time]',
        ],
      },
      {
        title: 'ADDITIONAL NOTE',
        items: [
          'As part of our preparation, we\'ll also be coordinating the sanitary line camera location, which needs to be completed in the coming weeks. We\'ll handle the logistics and keep you informed every step of the way.',
        ],
      },
      {
        title: 'CLOSING',
        items: [
          'Looking forward to hearing your response!',
          'Warm regards,',
        ],
      },
    ],
  },
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
          { text: 'Primary Contact:', sub: ['Phone:', 'Email:', 'Address:'] },
          "Owner's Estimated Budget:",
          'ADU Option:',
          'Topographic Survey:',
          'Funding for ADU Secured:',
          'Customer Preferred Method of Payment:',
          { text: 'Secondary Contact:', sub: ['Phone:', 'Email:', 'Address:'] },
        ],
      },
      {
        title: 'KEY SECTIONS & ATTACHMENTS',
        items: ['Topographic Survey & Plans', 'Photos', 'Avatar', 'Build Your ADU Checklist'],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — PRELIMINARY',
        items: [
          'Structure Type:', 'Flood Zone:', 'Historic:', 'Challenge in Setbacks:',
          'Challenge in Parking Requirements:', 'Exterior Wall Materials:', 'Exterior Facade:',
          'Roofing Material:', 'Construction Site Preparation:', 'General Elevation',
          'Bathroom Amenity Choices:', 'Shower Niche:',
        ],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — 50%–75% DRAWINGS',
        items: [
          'Ceiling Height:', 'Ceiling Style:', 'Roof Pitch:', 'Laundry:', 'Air Condition Handler:',
          'Downstairs Garage:', 'Separate Electric Meter:', 'Separate Water Meter:', 'Gas in ADU:',
          'Solar Power:', 'Generator:', 'Tesla Charger:', 'Driveway Options:', 'ADU Parking Option:',
          'Outdoor Space:', 'Garage Option:', 'Foundation & Footers:',
        ],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — 95% DRAWINGS',
        items: ['Decking Material:', 'Handrail Material'],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — 95% DRAWINGS — APPLIANCES',
        items: [
          'Refrigerator:', 'Dishwasher:', 'Garbage Disposal:', 'Stove:', 'Hood:',
          'Microwave:', 'Smart A/C Controls:',
        ],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — 95% DRAWINGS — ELECTRICAL',
        items: [
          'Recessed Ceiling Lighting:', 'Fans Installation:', 'Fans with Lights:',
          'Bathroom Exhaust Fan Lights:', 'Soffit Lights:', 'Electrical Outlets Location:',
          'Bathroom Fixture:', 'Wall Insulation:', 'Ceiling Insulation:',
        ],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — 95% DRAWINGS — ADDITIONAL OPTIONS & UPGRADES',
        items: [
          'Wall Texture:', 'Ceiling Texture:', 'Kitchen Backsplash:', 'Solid Core Doors:',
          'Large Upper Cabinets:', 'Crown Molding:', 'Hose Bibs Location:', 'Sanitary Line Upgrade:',
          'Soffit Material Preference:', 'CASK to Landscape New Outdoor Space:', 'Drywall in Garage:',
          'Non-Drywall Electrical Outlets:', 'Glass Windows in Garage Door:',
        ],
      },
      {
        title: 'BUILD YOUR ADU CHECKLIST — SIGNS AND TESTIMONIALS',
        items: [
          'Post Pre-Con Testimonial', 'Post Construction Testimonial',
          'Pre-Construction Sign', 'Construction Sign',
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
          'Date:', 'Meeting Time:', 'Location:',
          { text: 'Attendees:', sub: ['Property Owner/s:', 'Project Manager:', 'Project Specialist:', 'Others:'] },
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
        items: ['(Please refer to sketch)', 'Additional Notes:'],
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
          { text: 'Downstairs Garage:', sub: ['Utility Area', 'Laundry Area', 'Bathroom', 'Additional Notes:'] },
          { text: 'Laundry Location:', sub: ['Upstairs', 'Garage', 'No Laundry', 'Additional Notes:'] },
          { text: 'Ceiling Height: (Standard per NBC is 8 feet.) — 1st Floor / 2nd Floor', sub: ['8 feet — Standard', '9 feet ($)', '10 feet ($$)', 'Additional Notes:'] },
          { text: 'Ceiling Style:', sub: ['Flat Ceiling — Standard', 'Vaulted Ceiling ($)', 'Additional Notes:'] },
        ],
      },
      {
        title: '50%–75% DRAWINGS — MECHANICAL & UTILITY OPTIONS',
        items: [
          { text: 'Air Condition Handler:', sub: ['Attic', 'Mini-Split System', 'Additional Notes:'] },
          { text: 'Separate Meters:', sub: ['Electric Meter: Yes / No', 'Water Meter: Yes / No', 'Gas Meter: Yes / No', 'Additional Notes:'] },
        ],
      },
      {
        title: '50%–75% DRAWINGS — EXTERIOR & STRUCTURAL FEATURES',
        items: [
          { text: 'Driveway Options:', sub: ['Crushed Limestone — Standard', 'Concrete ($)', 'Brick Pavers ($$)', 'Additional Notes:'] },
          { text: 'Parking Options:', sub: ['Crushed Limestone — Standard', 'Concrete ($)', 'Brick Pavers ($$)', 'Additional Notes:'] },
          { text: 'Outdoor Space:', sub: ['Yes — Describe size and location:', 'No', 'Additional Notes:'] },
          { text: 'Garage Door Height:', sub: ['7 feet — Standard', '8 feet ($$)', 'Additional Notes:'] },
        ],
      },
      {
        title: '95% DRAWINGS — EXTERIOR FINISHES & DETAILS',
        items: [
          { text: 'Decking Material:', sub: ['Pressure Treated Lumber — Standard', 'Composite ($)', 'Additional Notes:'] },
          { text: 'Landscaping:', sub: ['Yes', 'No', 'Additional Notes:'] },
          { text: 'Garage Drywall:', sub: ['Yes ($)', 'No', 'Additional Notes:'] },
        ],
      },
      {
        title: 'SCHEDULING & COORDINATION',
        items: ['Buildertrend Record Photo Taken: YES / NO', 'Midway Design Meeting Scheduled:', 'Coordination Notes:'],
      },
      {
        title: 'YOUR GOAL FOR THIS PROJECT',
        items: ['What inspired you to start this project? (Extra space, income, family, etc.)', 'Please answer in 2–3 sentences'],
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
        items: ['Review the flagged property to outline the footprint of the project', 'Confirm utility locations with the Project Manager'],
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
        items: ['1. Distance of tree(s) to building:', '2. Size of tree(s):'],
      },
      {
        title: 'INITIAL SITE PLAN LAYOUT — UTILITIES',
        items: [
          { text: '1. Determine overhead electrical lines', sub: ['Does power to the main house need to be moved to construct the ADU?', '→ Yes: Method of moving electrical lines — Double meter can / Moving line on main / Duke service line', '→ No', 'Does the owner want a separate electric meter for the ADU?', '→ Yes: Location of meter on ADU; Cost implications', '→ No: Location for ADU panel; Trenching needed from main house panel (Yes/No); Is main house power sufficient for ADU (Yes/No)'] },
          { text: '2. Schedule for sanitary line to be located', sub: ['Is the sanitary line under the new ADU?', '→ Yes: Sections of sanitary that must be replaced', '→ No', 'Does the homeowner want to replace the existing sanitary line?', '→ Yes: Routing of new line: ___', '→ No: Nothing further needed.'] },
          { text: '3. Identify size of water line and where it ties into the main house', sub: ['If tied into existing house meter: Waterline location — where does ADU water line tie into main house water line?', 'If not tied into home meter: Need for a new meter (Yes/No); Cost implications:'] },
          { text: '4. Is there natural gas available on your property currently?', sub: ['→ Yes: What appliances do you want gas to service? / Where will it be fed? / Will it get a separate meter?', '→ No'] },
        ],
      },
      { title: 'ESTABLISH LOCATION OF PARKING', items: ['Parking Location:'] },
      { title: 'IF HISTORIC — SEND CUSTOMER EMAIL TO CLARIFY EXPECTATIONS', items: ['Yes (Explain to client for clarifications)', 'No'] },
      { title: 'ESTABLISH EXTERIOR DIMENSIONS', items: ['Dimensions:'] },
      { title: 'WALL LAYOUT', items: ['Preferred layout of furniture (use to understand functionality and flow of space)'] },
      { title: 'KITCHEN LAYOUT', items: ['Owner approves area of kitchen', 'Special features of kitchen'] },
    ],
    nps: true,
  },
  PS2m: {
    header: 'PS2m — In-Person 1st Selections with Customer',
    subheader: 'Phase 4: Pre-Construction Selections · Meeting',
    sections: [
      { title: 'ATTENDEES', items: ['Customer', 'Selections Manager', 'Project Manager'] },
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
      { title: 'ATTENDEES', items: ['Customer', 'Selections Manager', 'Project Manager'] },
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
      { title: 'ATTENDEES', items: ['Customer', 'Selections Manager', 'Project Manager'] },
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
      { title: 'ATTENDEES', items: ['Customer', 'Selections Manager', 'Project Manager'] },
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
      { title: 'PROJECT DETAILS', items: ['Date:', 'Project Name:', 'Customer Contact:', 'Project Manager Assign:'] },
      { title: 'WATERLINE — MARK ON PLANS', items: ['Position Water Meter Main House on the plan', 'Position Main Shut Off valve close to the main house (T point for ADU)'] },
      { title: 'WATERLINE — NOTES', items: ['Pipe Material:', 'Any problem that could occur during construction (Possible Tree/Roots, Pavers, etc.):', 'Notes & Recommendation:'] },
      { title: 'SEWER — MARK ON PLANS', items: ['Position Sewer Tap', 'Where Sewer run on the plan', 'Any Clean out if present'] },
      { title: 'SEWER — NOTES', items: ['Sewer Material and Condition:', 'Notes & Recommendation:'] },
      { title: 'ATTACHMENTS', items: ['Please attach any pictures'] },
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
          { text: 'Receive Contract Draft', sub: ['From internal legal/contracts team or directly from client', 'Save and version the document'] },
          { text: 'Initial Review by Project Manager', sub: ['Review scope of work', 'Verify schedule and milestones', 'Confirm payment structure', 'Identify risks, liabilities, and special clauses'] },
          { text: 'Flag Issues & Draft Comments', sub: ['Note inconsistencies, vague language, or missing items', 'Coordinate with Legal for legal/insurance terms', 'Coordinate with Estimating for cost implications', 'Coordinate with Scheduling for timeline feasibility'] },
          { text: 'Internal Team Review & Alignment', sub: ['Meet with Contracts/Legal', 'Meet with Estimating/Finance', 'Meet with Executive/Director (if needed)', 'Finalize your team\'s position on edits'] },
          { text: 'Share Feedback with Client', sub: ['Return redlined contract or comment summary', 'Schedule a review meeting to walk through changes', 'Aim for mutual agreement on scope, schedule, and terms'] },
          { text: 'Final Contract Revisions', sub: ['Incorporate agreed edits', 'Confirm all terms are updated accurately', 'Legal/PM do final internal check'] },
          { text: 'Execute Contract', sub: ['Both parties sign the finalized contract (digital or hard copy)', 'Distribute fully executed copy to stakeholders'] },
          { text: 'Project Kickoff', sub: ['Hold internal kickoff meeting', 'Share contract details with delivery team', 'Launch project planning and mobilization'] },
        ],
      },
    ],
    nps: true,
  },
  CG1m: {
    header: 'CG1m — Kickoff with Customer',
    subheader: 'Phase 6: Construction Groundbreaking · Meeting',
    sections: [
      { title: 'ITEMS TO PREPARE AHEAD OF MEETING', items: ['Create As-Built Folder on server', 'Updated field set of drawings', 'Cabinet layout', 'Updated BuilderTrend schedule', 'Window Spec. RO and sizes', 'Selection Packet'] },
      { title: 'PROJECT DETAILS', items: ['Date:', 'Time:', 'Location:', { text: 'Attendees:', sub: ['Project Manager', 'Superintendent', 'Customer', 'Other:'] }] },
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
      { title: 'EMAIL HEADER', items: ['Subject: Kick-Off Meeting Recap & Next Steps – [Project Address or Name]', 'From: [Project Manager]', 'To: [Customer Name]', 'Cc: [Superintendent]'] },
      { title: 'OPENING', items: ['Hi [Customer Name],', 'It was a pleasure meeting with you and discussing your vision for the project at [Project Address]. We truly appreciate your time and input, and we\'re excited to move forward together. Below is a quick recap of our conversation and what to expect next.'] },
      { title: 'MEETING NOTES', items: ['[Project Manager to input key discussion points here]', '–', '–', '–'] },
      { title: 'SCHEDULING & UPCOMING MILESTONES', items: ['Next Meeting: Foundation & Slab-on-Grade Meeting', 'Date & Time: [Insert details]', 'Next Milestone: We\'ll be reaching out soon with updates regarding: [Insert Next Milestone]'] },
      { title: 'CLOSING', items: ['Please don\'t hesitate to reach out if anything comes to mind — questions, ideas, or clarifications.', 'Survey: Construction Phase Feedback Survey (Customer Journey Survey Handout)', 'We\'re looking forward to building something great with you!'] },
    ],
  },
  'CG3.a': {
    header: 'CG3.a — Internal Sub Meeting',
    subheader: 'Phase 6: Construction Groundbreaking · Internal',
    sections: [
      { title: 'ATTENDANCE', items: ['Superintendent:', 'Subcontractors:'] },
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
      { title: 'ITEMS TO PREPARE AHEAD OF MEETING', items: [{ text: 'Updated field set of drawings', sub: ['Cabinet layout', 'Review window location and elevations (window rough openings)', 'Window specs and quote from supplier'] }, 'Lot needs to be pinned and blue top', 'Sanitary line needs to be scoped, and condition of sanitary line should be determined by plumber'] },
      { title: 'PROJECT DETAILS', items: ['Date:', 'Time:', 'Location:', { text: 'Attendees:', sub: ['Superintendent', 'Customer', 'Other:'] }] },
      {
        title: 'MEETING FLOW',
        numbered: true,
        items: [
          { text: 'Welcome and Introductions', sub: ['Quick overview of meeting objectives', 'Set expectations for entering the structural phase'] },
          { text: 'BuilderTrend Schedule Review', sub: ['Review structural milestones in BuilderTrend', 'Confirm projected dates for: Concrete pour, Formwork, Inspections', 'Identify any permitting/demo delays'] },
          { text: 'Site Walkthrough – Key Verifications', sub: ['Verify window sizes', 'Verify window locations', 'Verify siding finish material', 'Corners of building clearly marked', 'Rear setback verified', 'Side setback verified', 'Front setback verified', 'Slab-on-grade elevation validated', 'Sanitary/sewer line condition assessed — Replacement required? Yes / No'] },
          { text: 'Q&A and Next Steps', sub: ['Address any remaining questions or concerns', 'Confirm understanding of next steps', 'Schedule formwork, inspection, and pour', 'Log updates into BuilderTrend'] },
        ],
      },
    ],
    nps: true,
  },
  CG4e: {
    header: 'CG4e — Foundation and Slab On Grade Meeting Recap',
    subheader: 'Phase 6: Construction Groundbreaking · Email Template',
    sections: [
      { title: 'EMAIL HEADER', items: ['Subject: Foundation & Slab-on-Grade Meeting Recap & Next Steps – [Project Address or Name]', 'From: [Project Manager]', 'To: [Customer Name]', 'Cc: [Superintendent]'] },
      { title: 'OPENING', items: ['Hi [Customer Name],', 'It was great spending time with you during the walkthrough at [Project Address] and reviewing the final stages of your project. We\'re grateful for your feedback and collaboration throughout this process. Below is a summary of our discussion along with what\'s coming next.'] },
      { title: 'MEETING NOTES', items: ['[Project Manager to input key discussion points here]', '–', '–', '–'] },
      { title: 'SCHEDULING & UPCOMING MILESTONES', items: ['Next Meeting: (Meeting Title)', 'Date & Time: [Insert details]', 'Next Milestone: We\'ll be reaching out soon with updates regarding: [Insert Next Milestone]'] },
      { title: 'CLOSING', items: ['If you have any follow-up thoughts — please don\'t hesitate to reach out. Our goal is to keep everything clear, efficient, and aligned with your expectations from start to finish.', 'Survey: Construction Phase Feedback Survey (Customer Journey Survey Handout)', 'We\'re excited to bring your vision across the finish line!'] },
    ],
  },
  CS1e: {
    header: 'CS1e — Structure Stage Expectations Recap to Customer',
    subheader: 'Phase 7: Construction Structure · Email Template',
    sections: [
      { title: 'EMAIL HEADER', items: ['Subject: Structure Stage Preview & Celebration – [Project Address]', 'From: [Project Manager Name]', 'To: [Customer Name]', 'Cc: Superintendent, Framing Team, Concrete Team'] },
      { title: 'OPENING', items: ['Hi [Customer Name],', 'We\'re very excited to start the structure stage of your project! This is when your vision starts to come to reality.', 'As we approach the structure phase for [Project Address], please review the following expectations, schedules, and coordination items:'] },
      { title: "WHAT'S COMING UP", items: ['Framing progression', 'Roof setup and inspections', 'Wall sheathing installation', 'Prep for Mechanical, Electrical, Plumbing (MEP) rough-ins'] },
      { title: "WHO YOU'LL SEE ON-SITE", items: ['Our framing crew', 'Concrete specialists (if applicable)', 'Structural inspectors', 'Underground plumbing and electrical if applicable'] },
      { title: 'BEST PRACTICES', items: ['We\'ll notify nearby neighbors about increased site activity', 'All teams have been made aware of special conditions regarding parking and storing of material', 'Let us know if you have any questions, conflicts, or ideas — we\'re here to make this process as smooth and exciting as possible.'] },
      { title: 'WHAT TO LOOK FORWARD TO: STRUCTURE COMPLETE CELEBRATION', items: ['We\'d love to mark this milestone with you!', 'Please confirm a date/time that works best for your Structure Complete Meeting.', 'Suggested Date: [Insert Proposed Date]'] },
      { title: 'CLOSING', items: ['Survey: Construction Phase Feedback Survey (Customer Journey Survey Handout)', 'Looking forward to celebrating this big step with you!'] },
    ],
  },
  CS2m: {
    header: 'CS2m — Structure Complete Celebration with Customer',
    subheader: 'Phase 7: Construction Structure · Meeting',
    sections: [
      { title: 'ITEMS TO PREPARE AHEAD OF MEETING', items: ['Updated field set of drawings', 'Bring selections packet (vanities, lighting fixtures, plumbing fixtures)', 'Final kitchen layout – dimensions included on updated field set of plans', 'Updated ID drawing'] },
      { title: 'PROJECT DETAILS', items: ['Date:', 'Time:', 'Location:', { text: 'Attendees:', sub: ['Project Manager', 'Superintendent', 'Customer', 'Other:'] }] },
      {
        title: 'MEETING FLOW',
        numbered: true,
        items: [
          { text: 'Welcome & Overview', sub: ['Celebrate structure milestone', 'Set expectations for the next construction phase'] },
          { text: 'BuilderTrend Schedule Review', sub: ['Review updated schedule', 'Highlight upcoming stages: Rough-In (MEP), Inspections, Drywall'] },
          { text: 'Plan Set & Field Markup Review', sub: ['Bedroom: Lighting, Switch, Outlet, Fans', 'Bathroom: Lighting, Switch, Outlet, Vanity, Plumbing, Fans', 'Kitchen: Lighting, Switch, Outlet, Under cabinet lighting, Hood, Garbage disposal, Dishwasher, Ice maker', 'Living Room: Lighting, Switch, Outlet, Fans', 'Outside Area: Lighting, Switch, Outlet, Hose bibs, Water heater, Fans', 'Garage: Lights, Outlets, Switches, Garage door controls'] },
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
      { title: 'OPENING', items: ['Good afternoon,', 'Here is my weekly recap of this week\'s progress at my projects:'] },
      { title: 'CURRENT STATUS', items: ['Final electrical has been passed. All appliances are up and running including HVAC. Sod and irrigation completed. Final drainage was passed as well.'] },
      { title: 'UPCOMING WORK', items: [{ text: 'Interior:', sub: ['Final clean scheduled', 'Shower glass installation', 'Punch list items being added to Buildertrend'] }, { text: 'Exterior:', sub: ['Pressure wash deck, stairs, and siding'] }] },
      { title: 'NEXT STEPS', items: ['Working toward CO. Plan on meeting the building inspector to push it through and address any questions.'] },
    ],
  },
  CC4m: {
    header: 'CC4m — Final Walkthrough with Customer',
    subheader: 'Phase 10: Construction Closeout · Meeting',
    sections: [
      { title: 'INTRODUCTION', items: ['Project Manager to start by explaining the status of Certification of Completion (CO) and closing out of Permit.', 'State the overall purpose of the meeting: to ensure the customer is confident and satisfied with the product, aiming for 100% satisfaction by the conclusion of the meeting.'] },
      { title: 'INTERIOR WALKTHROUGH', items: [{ text: 'Doors and Windows', sub: ['Touch and test every door and window to ensure proper opening and closing.', 'Demonstrate how to open, close, and lock all windows.'] }, { text: 'Appliances', sub: ['Test all appliances to confirm they are working properly.'] }, { text: 'Walls and Rooms', sub: ['Ensure the customer sees every wall in each room to identify any punch list items and mark with blue tape where necessary.'] }, { text: 'Thermostat', sub: ['Operate thermostat with the homeowner to ensure proper function.'] }] },
      { title: 'EXTERIOR WALKTHROUGH', items: [{ text: 'Property Perimeter', sub: ['Walk around the outside of the property with the customer.', 'Point out all utility connections.', 'Identify any exterior punch list items.'] }, { text: 'Signage', sub: ['Remove any signage from the property.'] }] },
      { title: 'FINAL STEPS', items: [{ text: 'Punch List Review', sub: ['Review all punch list items with the customer to confirm nothing was missed.'] }, { text: 'ADU Best Practices Sheet', sub: ['Provide customer with the CASK ADU Best Practices sheet.'] }] },
      { title: 'CUSTOMER ACKNOWLEDGEMENT', items: ['I acknowledge that I have completed the final walkthrough and understand any remaining punch list items that are to be addressed post-meeting.', 'Customer Signature: _________________', 'Project Manager Signature: _________________', 'Date: _________________'] },
    ],
    nps: true,
  },
  CC3e: {
    header: 'CC3e — Punch List Walkthrough Meeting Recap to Customer',
    subheader: 'Phase 10: Construction Closeout · Email',
    sections: [
      { title: 'EMAIL DETAILS', items: ['Subject: Punch List Walkthrough Recap & Next Steps – [Project Address or Name]', 'From: [Project Manager Name]', 'To: [Customer Name]', 'Cc: Superintendent, Marketing Manager'] },
      { title: 'EMAIL BODY', items: ['Hi [Customer Name],', 'Thank you for walking around the site with us today during your Punch List Walkthrough at [Project Address]. We\'re grateful for your time and attention to detail as we work toward wrapping up your project with confidence.', 'Below is a summary of what we reviewed and what to expect moving forward:'] },
      { title: 'MEETING NOTES', items: ['[Project Manager provides the meeting notes]', '-', '-', '-'] },
      { title: 'WHAT\'S NEXT', items: ['– Our team will begin addressing all outstanding items immediately', '– You\'ll receive updates via Buildertrend as items are completed', '– Once all punch list items are marked as complete, we\'ll schedule the Final Walkthrough', 'To help us continue delivering a top-tier construction experience, we\'d appreciate it if you could take a minute to answer our Construction Phase Feedback Survey.', 'CUSTOMER JOURNEY SURVEY HANDOUT', 'We\'re almost there! Thank you for your partnership and trust throughout this journey.'] },
    ],
  },
  CC2m: {
    header: 'CC2m — Punchlist Walkthrough with Customer',
    subheader: 'Phase 10: Construction Closeout · Meeting',
    sections: [
      { title: 'ITEMS TO PREPARE AHEAD OF MEETING', items: ['Updated field set of drawings', 'Bring selections packet (vanities, lighting fixtures, plumbing fixtures)', 'Updated kitchen layout', 'Updated ID drawing', 'Customer and superintendent Buildertrend punch list'] },
      { title: 'ATTENDANCE', items: ['Project Manager', 'Superintendent', 'Customer'] },
      {
        title: 'MEETING FLOW',
        numbered: true,
        items: [
          { text: 'Welcome & Meeting Purpose', sub: ['Explain the goal of the walkthrough: verify completion and identify final punch items', 'Confirm all teams are aligned on the close-out timeline'] },
          { text: 'Site Walkthrough – Punch Item Review', sub: ['Walk each room/zone of the project', 'Identify and document: Missing Items, Items needing repair or touch-up, Items requiring adjustment'] },
          { text: 'Live Updates to Punch List', sub: ['Log all noted issues into Buildertrend or project tracker', 'Assign responsible trades/subs', 'Set target dates for resolution'] },
          { text: 'Customer Sign-Off', sub: ['Final inspections (if applicable)', 'Schedule turnover meeting', 'Final site cleanup'] },
        ],
      },
    ],
    nps: true,
  },
  'CC1e.1': {
    header: 'CC1e.1 — Certificate of Occupancy to Customer',
    subheader: 'Phase 10: Construction Closeout · Email',
    sections: [
      { title: 'EMAIL DETAILS', items: ['Sender: Project Manager', 'Cc: Superintendent', 'Subject: Congratulations! Your Project Has Received Its Certificate of Occupancy'] },
      { title: 'EMAIL BODY', items: ['Hi [Customer Name],', 'Great news — your project has officially received its Certificate of Occupancy! This is a major milestone, and it means your space has passed all final inspections and is approved for use.', 'Your project has come a long way, and we\'re thrilled to reach this important completion stage with you.'] },
      { title: 'NEXT STEPS', items: ['Final Walkthrough: I will be reaching out to schedule a final walkthrough to ensure everything is complete and meets your expectations.', 'Closeout Documents: We will provide any remaining documentation related to your project, including warranties, manuals, and final photos (if applicable).', 'Final Invoice: If there are any outstanding balances, our team will issue the final invoice for your review.', 'If you have any questions as we wrap things up or need anything clarified, please feel free to reach out at any time.'] },
    ],
  },
  CC1e: {
    header: 'CC1e — Close Out Steps to Customer',
    subheader: 'Phase 10: Construction Closeout · Email',
    sections: [
      { title: 'EMAIL DETAILS', items: ['Subject: Final Steps & Punch List Walkthrough – [Project Address or Name]', 'From: [Project Manager Name]', 'To: [Customer Name]', 'Cc: Superintendent'] },
      { title: 'EMAIL BODY', items: ['Hi [Customer Name],', 'As we approach the final stretch of your project at [Project Address], we\'re excited to begin the close-out process and schedule your punch list walkthrough. This is where we tie up final details and prepare for project turnover.'] },
      { title: 'AVAILABLE TIMES FOR PUNCH LIST WALKTHROUGH', items: ['Please let us know which of the following dates and times work best for you:', '– [Option 1: Date & Time]', '– [Option 2: Date & Time]', '– [Option 3: Date & Time]', 'This walkthrough gives us a chance to walk the space with you, note any outstanding items, and ensure everything is to your satisfaction before final turnover.'] },
      { title: 'WHAT HAPPENS DURING CLOSE-OUT', items: ['Here\'s what to expect in the coming days:', '– Punch List Creation: We\'ll document any touch-ups or final items to be completed', '– Permitting & Final Inspections: We\'ll manage the final steps to close out permits with the city', '– Turnover: Once all punch list items are completed, we\'ll schedule your final hand-off and provide any necessary documents or warranty info'] },
      { title: 'HELP US IMPROVE', items: ['To help us continue delivering a top-tier construction experience, we\'d appreciate it if you could take a minute to answer our Construction Phase Feedback Survey.', 'CUSTOMER JOURNEY SURVEY HANDOUT', 'Looking forward to wrapping up strong and handing over your beautiful space soon!'] },
    ],
  },
  CF2e: {
    header: 'CF2e — Finish Meeting Recap to Customer',
    subheader: 'Phase 9: Construction Finish · Email',
    sections: [
      { title: 'EMAIL DETAILS', items: ['Subject: Finish Stage Meeting Recap & What\'s Next – [Project Address or Name]', 'From: [Project Manager Name]', 'To: [Customer Name]', 'Cc: Superintendent, Selections Manager, Relevant Subcontractors'] },
      { title: 'EMAIL BODY', items: ['Hi [Customer Name],', 'It was such a pleasure meeting with you today on-site! We\'re officially in the finish stage—a huge milestone where your vision really starts coming to life.', 'Here\'s a quick recap of what we discussed and what you can expect next:'] },
      { title: 'MEETING NOTES', items: ['[Project Manager to input key discussion points here]', '–', '–', '–'] },
      { title: 'WHAT\'S COMING UP', items: ['– We\'ll be wrapping up drywall and beginning finish installations very soon', '– Your job box has been updated with your full selections packet and QR code sheet for quick reference', '– You\'ll start seeing more trades on-site, and we\'ll continue sending progress updates along the way', 'CUSTOMER JOURNEY SURVEY HANDOUT', 'Thanks again for letting us build this with you. We\'re almost there!'] },
    ],
  },
  CF1m: {
    header: 'CF1m — Finishes with Customer',
    subheader: 'Phase 9: Construction Finish · Meeting',
    sections: [
      { title: 'ITEMS TO PREPARE AHEAD OF MEETING', items: ['Updated field set of drawings', 'Bring selections packet (vanities, lighting fixtures, plumbing fixtures)', 'Updated kitchen layout', 'Updated ID drawing'] },
      { title: 'ATTENDANCE', items: ['Project Manager', 'Superintendent', 'Selections Manager', 'Customer'] },
      {
        title: 'MEETING FLOW',
        numbered: true,
        items: [
          { text: 'Welcome & Milestone Acknowledgment', sub: ['Congratulate customer for reaching this stage', 'Celebrate the near completion of customer project'] },
          { text: 'Buildertrend Schedule Review', sub: ['Set expectations for drywall hanging and items scheduled after', 'Start of customer-selected finishes'] },
          { text: 'Selections & Finish Confirmation', sub: ['Review the selections packet', 'Walk through each finish scope, room by room:', 'Bedroom: Flooring, Ceiling Fans, Paint, Tile Route, Trim, Fixtures', 'Kitchen: Flooring, Cabinets, Under Cabinet lighting, Paint, Tile Route, Grout, Trim, Fixtures', 'Bathroom: Flooring, Vanity, Paint, Tile on Walls, Shower Flooring, Trim, Fixtures, Niche, Grout', 'Living Room: Lighting, Fans, Flooring, Stair Tread Finish', 'Garage: Wall Finishes, Utility Area, Lighting, Flooring', 'Outside Area: Wall Finishes, Wall Lighting, Walkways', 'Porch: Ceiling Finish, Fans, Lighting, Flooring/Decking Finish, Railings/Handrail'] },
          { text: 'Field Drawing Updates', sub: ['Update/mark field drawings with final selections', 'Ensure clarity for subcontractor execution'] },
          { text: 'Site Access & Communication', sub: ['Verify construction sign is posted', 'Confirm job box is stocked with QR code sheet and selections packet'] },
          { text: 'Q&A and Next Steps', sub: ['Address any questions from the customer', 'Review expected completion window', 'Note any open selections or action items'] },
        ],
      },
    ],
    nps: true,
  },
  'CF1.a': {
    header: 'CF1.a — Internal Sub Meeting',
    subheader: 'Phase 9: Construction Finish · Internal',
    sections: [
      { title: 'ATTENDANCE', items: ['Superintendent', 'Subcontractors'] },
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
      { title: 'EMAIL DETAILS', items: ['Sender: Project Manager', 'Cc: Superintendent', 'Subject: Your Project Is Ready for Drywall – Approved to Hang!'] },
      { title: 'EMAIL BODY', items: ['Hi [Customer Name],', 'Congratulations! Your project has officially passed the insulation inspection, and we are released to hang drywall. Everything is moving along nicely and right on track.', 'The next step in your project will be to schedule the Finishes Meeting.'] },
      { title: 'THIS PROCESS ENSURES THAT THE', items: ['Schedule and selections packet are fully reviewed', 'All field drawings and finishes (including kitchen and bathroom layouts) are verified', 'Installation details are confirmed prior to moving forward'] },
      { title: 'SCHEDULING', items: ['Are you available during these timeslots?', 'Date and Time 1', 'Date and Time 2', 'Date and Time 3', 'CUSTOMER JOURNEY SURVEY HANDOUT', 'If you have any questions or concerns at this stage of your project, please don\'t hesitate to reach out — I\'m here to support you every step of the way.'] },
    ],
  },
  CR1m: {
    header: 'CR1m — Rough In with Customer',
    subheader: 'Phase 8: Construction Rough In · Meeting',
    sections: [
      { title: 'ATTENDANCE', items: ['Superintendent', 'Customer'] },
      {
        title: 'MEETING FLOW',
        numbered: true,
        items: [
          { text: 'Welcome & Purpose', sub: ['Set expectations for the rough-in phase', 'Confirm this meeting occurs prior to rough-in electrical inspection'] },
          { text: 'BuilderTrend Schedule Review', sub: ['Review current schedule', 'Highlight next milestones leading into inspection and drywall phases'] },
          { text: 'Field Plan & Installation Walkthrough', sub: ['Review permitted plans and marked-up field set', 'Confirm proper installation of: Electrical layout, Kitchen layout, Bathroom lighting and vanity, Plumbing, HVAC systems'] },
          { text: 'Neighbor Considerations', sub: ['Address any known concerns raised by homeowner', 'Determine if direct communication from CASK is necessary'] },
          { text: 'Job Site Signage & Plan Access', sub: ['Confirm construction sign is posted and visible', 'Confirm job box is in place', 'Verify QR code sheet is available and leads to most updated plans'] },
          { text: 'Q&A and Next Steps', sub: ['Answer customer questions regarding installations or inspections', 'Confirm timing of inspection and drywall start', 'Note any follow-up tasks or adjustments needed'] },
        ],
      },
    ],
    nps: true,
  },
  'CR1.a': {
    header: 'CR1.a — Internal Sub Meeting',
    subheader: 'Phase 8: Construction Rough In · Internal',
    sections: [
      { title: 'ATTENDANCE', items: ['Superintendent', 'Subcontractors'] },
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
      { title: 'MEP LAYOUT — ELECTRICAL LAYOUT', items: ['1. Outdoor lighting if necessary', '2. Indoor lighting options'] },
      { title: 'MEP LAYOUT — PLUMBING', items: ['1. Locate hose bibs', '2. Location of water heater', '3. Tub or shower selection', '4. Location of shower valve (preferred not on exterior wall)'] },
      { title: 'MEP LAYOUT — MECHANICAL', items: ['1. Location of air handler', '2. Location of condenser', '3. Determine if range hood exhaust is vented to outside'] },
      { title: 'ELEVATIONS', items: ['Confirm Window Placement', 'Garage door height – confirm at 7 ft'] },
    ],
    nps: true,
  },
}
