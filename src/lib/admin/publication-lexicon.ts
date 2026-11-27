/**
 * The part of Standard.site's site.standard.publication lexicon that the Publication editor
 * (src/lib/admin/page-editor.ts) shows: its name, description, logo and preferences, as published
 * by standard.site (com.atproto.lexicon.schema in did:plc:re3ebnp5v7ffagz6rb6xfei4). It isn't in
 * lexicons/: the NSID is Standard.site's, so this site never publishes it. Saving checks a record
 * against this part; the record's other fields (url, basicTheme, labels) are kept as they are.
 */
import type { LexiconDoc } from './lexicon-form';

export const publicationLexicon = {
  lexicon: 1,
  id: 'site.standard.publication',
  defs: {
    main: {
      type: 'record',
      key: 'tid',
      description: 'A publication: a blog or website that holds documents (posts), with its name and logo.',
      record: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 5000, maxGraphemes: 500, description: 'Name of the publication.' },
          description: { type: 'string', maxLength: 30000, maxGraphemes: 3000, description: 'What it is, in a line or two: readers show it under the name.' },
          icon: { type: 'blob', accept: ['image/*'], maxSize: 1000000, description: 'Square image to identify the publication. Should be at least 256x256.' },
          preferences: { type: 'ref', ref: '#preferences' },
        },
      },
    },
    preferences: {
      type: 'object',
      properties: {
        showInDiscover: { type: 'boolean', default: true, description: 'Let readers list it in their discovery feeds.' },
      },
    },
  },
} as unknown as LexiconDoc;
