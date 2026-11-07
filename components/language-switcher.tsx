'use client';

import React, { type ChangeEvent, useEffect, useState } from 'react';

import { getStoredLocale, localeLabels, persistLocale, resolveLocale, type Locale } from '../lib/i18n';

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
    <label className="opsfinance-language-picker" aria-label="Select language">
      <span className="sr-only">Language</span>
      <select value={locale} onChange={handleChange} aria-label="Select language">
        {(['en', 'ms', 'zh-CN', 'ta'] as const).map((option) => (
          <option key={option} value={option}>
            {localeLabels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
