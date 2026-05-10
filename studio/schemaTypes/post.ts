import { defineType, defineField } from 'sanity'

export const postType = defineType({
  name: 'post',
  type: 'document',
  title: 'Blog Post',
  fields: [
    defineField({ name: 'title', type: 'string', title: 'H1 Title', validation: (r) => r.required() }),
    defineField({ name: 'category', type: 'string', title: 'Category' }),
    defineField({
      name: 'slug', type: 'slug', title: 'URL Slug',
      options: { source: 'title', maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'author', type: 'string', title: 'Author' }),
    defineField({ name: 'publishedAt', type: 'datetime', title: 'Publish Date' }),
    defineField({ name: 'seoTitle', type: 'string', title: 'SEO Meta Title' }),
    defineField({ name: 'metaDescription', type: 'text', title: 'Meta Description', rows: 3 }),
    defineField({ name: 'keywords', type: 'array', title: 'SEO Keywords', of: [{ type: 'string' }], options: { layout: 'tags' } }),
    defineField({ name: 'aiSummary', type: 'text', title: 'AI Summary (machine audience)', rows: 4 }),
    defineField({
      name: 'mainImage', type: 'image', title: 'Cover Image',
      options: { hotspot: true },
      fields: [defineField({ name: 'alt', type: 'string', title: 'Alt Text' })],
    }),
    defineField({ name: 'body', type: 'text', title: 'Body (plain text / markdown fallback)', rows: 10 }),
    defineField({
      name: 'richBody', type: 'array', title: 'Body (rich text)',
      of: [
        {
          type: 'block',
          styles: [
            { title: 'Normal', value: 'normal' },
            { title: 'H2', value: 'h2' },
            { title: 'H3', value: 'h3' },
            { title: 'H4', value: 'h4' },
            { title: 'Quote', value: 'blockquote' },
          ],
          lists: [
            { title: 'Bullet', value: 'bullet' },
            { title: 'Numbered', value: 'number' },
          ],
          marks: {
            decorators: [
              { title: 'Strong', value: 'strong' },
              { title: 'Italic', value: 'em' },
              { title: 'Code', value: 'code' },
              { title: 'Underline', value: 'underline' },
            ],
            annotations: [
              {
                name: 'link', type: 'object', title: 'Link',
                fields: [defineField({ name: 'href', type: 'url', title: 'URL', validation: (r) => r.uri({ allowRelative: true }) })],
              },
            ],
          },
        },
        {
          type: 'image',
          options: { hotspot: true },
          fields: [
            defineField({ name: 'alt', type: 'string', title: 'Alt Text' }),
            defineField({ name: 'caption', type: 'string', title: 'Caption' }),
          ],
        },
      ],
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'publishedAt', media: 'mainImage' },
  },
})
