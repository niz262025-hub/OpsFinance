'use client';

import React, { type ChangeEvent, useEffect, useState } from 'react';

import { getStoredLocale, getTranslation, localeLabels, persistLocale, resolveLocale, type Locale } from '../lib/i18n';

export function LanguageSwitcher({ value, onChange }: { value?: Locale; onChange?: (locale: Locale) => void }) {
  const [locale, setLocale] = useState<Locale>(value ?? getStoredLocale());

  useEffect(() => {
    const current = resolveLocale(value ?? getStoredLocale());
    setLocale(current);
    persistLocale(current);
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = resolveLocale(event.target.value) as Locale;
    setLocale(nextLocale);
    persistLocale(nextLocale);
    onChange?.(nextLocale);
  };

  return (
    <label className="opsfinance-language-picker" aria-label={getTranslation(locale,'languageSelector')}>
      <span className="sr-only">{getTranslation(locale,'language')}</span>
      <select value={locale} onChange={handleChange} aria-label={getTranslation(locale,'languageSelector')}>
        {(['en', 'ms', 'zh-CN', 'ta'] as const).map((option) => (
          <option key={option} value={option}>
            {localeLabels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
