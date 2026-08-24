import type { QueryLabels } from "@jmouse/query"

/**
 * The builder's words, in Innoventa's language.
 *
 * ⚠️ Props rather than a translation service, deliberately — see `@jmouse/query`'s `labels.ts`. Two of
 * these products do not use the same translation service, so a shared component that reached for one
 * would force them together over a row of chip captions.
 */
export const QUERY_LABELS: Partial<QueryLabels> = {
  operators: {
    contains: "містить",
    notContains: "не містить",
    starts: "починається з",
    ends: "закінчується на",
    equals: "дорівнює",
    notEquals: "не дорівнює",
    greater: "більше ніж",
    greaterOrEqual: "не менше ніж",
    less: "менше ніж",
    lessOrEqual: "не більше ніж",
    empty: "порожнє",
    notEmpty: "не порожнє",
  },
  builderTab: "Конструктор",
  textTab: "Текст",
  noConditions: "Жодної умови — список показує все. Додайте першу, щоб звузити.",
  addCondition: "Умова",
  removeCondition: "Прибрати умову",
  field: "Поле",
  value: "Значення",
  includeMissing: "і ті, у кого такого поля немає взагалі",
  sortBy: "Сортувати за",
  sortDefault: "За замовчуванням",
  descending: "за спаданням",
  reset: "Скинути",
  apply: "Застосувати",
  presets: "Готові питання",
  handWritten:
    "⚠️ Цей запит написаний вручну — конструктор не намагається його перемалювати, бо тихо переписати " +
    "чийсь вираз гірше, ніж чесно сказати. Редагуйте текстом.",
  readable: "Запит читається.",
  converterNote: (converter) =>
    `⚠️ Це поле зберігається текстом, тож порівняння читається як число — у запит додається | ${converter}. ` +
    `Без цього «900» було б більшим за «1000».`,
}
