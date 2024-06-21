export const transformationParams = {
  mode: "document",
  model: "trellis-premium",
  operations: [
    {
      column_name: "email_from",
      column_type: "text",
      output_values: null,
      transform_type: "extraction",
      task_description: "extract who sent the email. This should be in From",
    },
    {
      column_name: "email_to",
      column_type: "text[]",
      output_values: null,
      transform_type: "extraction",
      task_description: "Extract a list of emails in the To section",
    },
    {
      column_name: "people_mentioned",
      column_type: "text[]",
      output_values: null,
      transform_type: "extraction",
      task_description:
        "Extract a list of people mentioned in the email. Return empty list if no one is being mentioned.",
    },
    {
      column_name: "compliance_risk",
      column_type: "text",
      output_values: {
        No: "the email does not potential compliance violation ",
        Yes: "the email contains potential compliance violation ",
      },
      transform_type: "classification",
      task_description:
        "Classify whether the email contains information that's potential compliance violation",
    },
    {
      column_name: "one_line_summary",
      column_type: "text",
      output_values: null,
      transform_type: "generation",
      task_description: "Summarize the email in one line",
    },
    {
      column_name: "genre",
      column_type: "text",
      output_values: {
        employment:
          "topics related to job seeking, hiring, recommendations, etc",
        empty_message: "no information in the text",
        document_review: "collaborating on document, editing",
        purely_personal: "personal chat unrelated to work",
        company_business: "related to company business",
        logistics_arrangement: "meeting scheduling, technical support, etc",
        personal_professional:
          "Personal but in professional context (e.g., it was good working with you)",
      },
      transform_type: "classification",
      task_description: "Classify the genre of the emails.",
    },
    {
      column_name: "primary_topics",
      column_type: "text",
      output_values: {
        legal: "Topics around legal advice or involve legal matters",
        other: "Other topics not include in the existing categories",
        political:
          "Topics related political influence / contributions / contacts",
        regulation:
          "Topics around regulations and regulators (includes price caps)",
        company_image: "Topics around company image",
        energy_crisis:
          "Topics related to california energy crisis / california politics ",
        internal_project:
          "Topics around internal projects -- progress and strategy",
        internal_operations: "Topics around Internal operations",
      },
      transform_type: "classification",
      task_description: "Classify the specific topics of conversation",
    },
    {
      column_name: "emotional_tone",
      column_type: "text",
      output_values: {
        anger: "The email has angry, aggresive or agitate tone. ",
        humor: "The email is funny or has humorous tone",
        secret:
          "The email has secrecy / confidentiality tone or contains confidential information. ",
        concern: "The email seems concern, worry or anxious",
        neutral: "The email is neutral",
        gratitude: "The email has gratitude or admiration tone",
      },
      transform_type: "classification",
      task_description: "Classify the tone and intent of the message. ",
    },
    {
      column_name: "date",
      column_type: "text",
      output_values: null,
      transform_type: "extraction",
      task_description: "Extract the date of the email in MM/DD/YYYY format",
    },
  ],
};
