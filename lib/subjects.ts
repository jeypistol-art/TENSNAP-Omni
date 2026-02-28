export const SUBJECT_OPTIONS = [
    "算数/数学",
    "英語/外国語",
    "国語",
    "理科/科学/理数",
    "社会/地理/歴史",
] as const;

export const DEFAULT_SUBJECT = SUBJECT_OPTIONS[0];

export type SubjectCategory = "math" | "english" | "japanese" | "science" | "social" | "other";

const includesAny = (value: string, keywords: string[]) =>
    keywords.some((keyword) => value.includes(keyword));

export function detectSubjectCategory(subject?: string): SubjectCategory {
    const value = (subject || "").trim().toLowerCase();
    if (!value) return "other";

    if (includesAny(value, ["算数", "数学", "算数/数学", "math", "algebra"])) return "math";
    if (includesAny(value, ["英語", "外国語", "英語/外国語", "english", "language"])) return "english";
    if (includesAny(value, ["国語", "japanese"])) return "japanese";
    if (includesAny(value, ["理科", "科学", "理数", "理科/科学/理数", "science", "stem"])) return "science";
    if (includesAny(value, ["社会", "地理", "歴史", "社会/地理/歴史", "social", "geography", "history"])) return "social";

    return "other";
}

export function normalizeSubjectLabel(subject?: string): string {
    if (!subject) return "";

    switch (detectSubjectCategory(subject)) {
        case "math":
            return "算数/数学";
        case "english":
            return "英語/外国語";
        case "japanese":
            return "国語";
        case "science":
            return "理科/科学/理数";
        case "social":
            return "社会/地理/歴史";
        default:
            return subject;
    }
}

export function subjectAliasesForFilter(subject?: string): string[] {
    const category = detectSubjectCategory(subject);
    const aliases = (() => {
        switch (category) {
            case "math":
                return ["算数/数学", "数学", "算数", "Math", "math"];
            case "english":
                return ["英語/外国語", "英語", "外国語", "English", "english"];
            case "japanese":
                return ["国語"];
            case "science":
                return ["理科/科学/理数", "理科", "科学", "理数", "Science", "science"];
            case "social":
                return ["社会/地理/歴史", "社会", "地理", "歴史", "Social", "social"];
            default:
                return subject ? [subject] : [];
        }
    })();

    return [...new Set(aliases)];
}

export function isSubjectMatch(subject: string | undefined, filter: string | undefined): boolean {
    if (!filter || filter === "all") return true;
    return detectSubjectCategory(subject) === detectSubjectCategory(filter);
}
