import i18next, { type TFunction } from "i18next";
import fs from "node:fs";
import path from "node:path";
import { pino } from "pino";

// ─── Types ──────────────────────────────────────────────────────────

export interface I18nConfig {
    defaultLanguage?: string;
    fallbackLanguage?: string;
    localesDir?: string;
}

// ─── I18n Manager Singleton ─────────────────────────────────────────

const logger = pino({ name: "i18n" });

class I18nManager {
    private static instance: I18nManager;
    private initialized = false;

    private constructor() { }

    static getInstance(): I18nManager {
        if (!I18nManager.instance) {
            I18nManager.instance = new I18nManager();
        }
        return I18nManager.instance;
    }

    /**
     * Initialize i18next with locale files.
     */
    async initialize(config: I18nConfig = {}): Promise<void> {
        if (this.initialized) return;

        const {
            defaultLanguage = "en",
            fallbackLanguage = "en",
            localesDir = path.resolve(import.meta.dirname || __dirname, "locales"),
        } = config;

        const resources: Record<string, { translation: Record<string, unknown> }> = {};

        // Load locale files dynamically
        if (fs.existsSync(localesDir)) {
            const files = fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"));
            for (const file of files) {
                const lang = path.basename(file, ".json");
                const filePath = path.join(localesDir, file);
                const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                resources[lang] = { translation: content };
            }
        }

        await i18next.init({
            lng: defaultLanguage,
            fallbackLng: fallbackLanguage,
            resources,
            interpolation: {
                escapeValue: false,
            },
        });

        this.initialized = true;
        logger.info(
            { languages: Object.keys(resources), default: defaultLanguage },
            "i18n initialized",
        );
    }

    /**
     * Translate a key.
     */
    t(key: string, options?: Record<string, unknown>): string {
        if (!this.initialized) {
            logger.warn("i18n not initialized, returning key as-is");
            return key;
        }
        return i18next.t(key, options as any) as string;
    }

    /**
     * Get a translation function for a specific language.
     */
    getFixedT(language: string): TFunction {
        return i18next.getFixedT(language);
    }

    /**
     * Change the current language.
     */
    async changeLanguage(language: string): Promise<void> {
        await i18next.changeLanguage(language);
        logger.info({ language }, "Language changed");
    }

    /**
     * Get list of available languages.
     */
    getLanguages(): string[] {
        return Object.keys(i18next.store?.data || {});
    }

    /**
     * Get the current language.
     */
    getCurrentLanguage(): string {
        return i18next.language;
    }
}

export const i18n = I18nManager.getInstance();
