/**
 * Describes what the editor knows about each Glance widget.
 *
 * This catalog is transcribed by hand from the Glance source
 * (`internal/glance/widget.go`, `internal/glance/widget-*.go`) and
 * `docs/configuration.md`. It deliberately exposes only the fields needed to
 * make a widget work — Glance's own defaults cover the rest, and the
 * glance-schema JSON schema covers exhaustive editing in an IDE.
 */

export type FieldDef =
  | {
      kind: 'string' | 'text' | 'url' | 'secret';
      key: string;
      label: string;
      required?: boolean;
      placeholder?: string;
      help?: string;
    }
  | {
      kind: 'number';
      key: string;
      label: string;
      required?: boolean;
      min?: number;
      default?: number;
      help?: string;
    }
  | {
      kind: 'boolean';
      key: string;
      label: string;
      required?: boolean;
      default?: boolean;
      help?: string;
    }
  | {
      kind: 'enum';
      key: string;
      label: string;
      options: string[];
      required?: boolean;
      default?: string;
      help?: string;
    }
  | {
      kind: 'stringList';
      key: string;
      label: string;
      required?: boolean;
      itemPlaceholder?: string;
      help?: string;
    }
  | {
      /** A `map[string]string` in Glance, such as `headers`. */
      kind: 'keyValue';
      key: string;
      label: string;
      required?: boolean;
      help?: string;
    }
  | {
      /**
       * A shape too complex to model as a form. Edited as YAML and stored as
       * the parsed value, so it round-trips into the export untouched.
       */
      kind: 'raw';
      key: string;
      label: string;
      required?: boolean;
      help?: string;
    }
  | {
      kind: 'objectList';
      key: string;
      label: string;
      required?: boolean;
      /** Field shown on the collapsed row summary. */
      summaryKey: string;
      fields: FieldDef[];
      help?: string;
    };

export type WidgetCategory =
  | 'Feeds'
  | 'Monitoring'
  | 'Media'
  | 'Utility'
  | 'Layout'
  | 'Advanced'
  /** Widgets discovered in an uploaded catalog that this build does not ship. */
  | 'Imported';

export type WidgetDef = {
  /** Exact Glance `type:` value. */
  type: string;
  label: string;
  category: WidgetCategory;
  description: string;
  /** True for `group` and `split-column`, which hold nested widgets. */
  container?: boolean;
  fields: FieldDef[];
};

/** Fields Glance accepts on every widget (`widgetBase`). */
export const SHARED_FIELDS: FieldDef[] = [
  {
    kind: 'string',
    key: 'title',
    label: 'Title',
    placeholder: 'widget default',
    help: 'Overrides the heading Glance picks for this widget.',
  },
  {
    kind: 'string',
    key: 'cache',
    label: 'Cache',
    placeholder: 'widget default',
    help: 'How long to reuse fetched data. Single unit only, e.g. 30s, 5m, 12h, 1d.',
  },
];

/** Matches Glance's durationField regex: ^(\d+)(s|m|h|d)$ */
export const DURATION_PATTERN = /^\d+(s|m|h|d)$/;
