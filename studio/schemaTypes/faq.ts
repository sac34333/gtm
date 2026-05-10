import { defineType, defineField } from 'sanity'

export const faqType = defineType({
  name: 'faq',
  type: 'document',
  title: 'FAQ',
  fields: [
    defineField({ name: 'question', type: 'string', title: 'Question', validation: (r) => r.required() }),
    defineField({ name: 'answer', type: 'text', title: 'Answer', rows: 5, validation: (r) => r.required() }),
    defineField({
      name: 'category', type: 'string', title: 'Category',
      options: {
        list: [
          { title: 'General', value: 'general' },
          { title: 'Features', value: 'features' },
          { title: 'LinkedIn Integration', value: 'linkedin' },
          { title: 'Pricing', value: 'pricing' },
          { title: 'Security', value: 'security' },
          { title: 'AI Models', value: 'ai-models' },
          { title: 'Prospect Enrichment', value: 'enrichment' },
        ],
      },
    }),
    defineField({ name: 'order', type: 'number', title: 'Display Order' }),
  ],
  preview: {
    select: { title: 'question', subtitle: 'category' },
  },
})
