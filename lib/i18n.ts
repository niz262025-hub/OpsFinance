export type Locale = 'en' | 'ms' | 'zh-CN' | 'ta';

export const DEFAULT_LOCALE: Locale = 'en';
export const SUPPORTED_LOCALES: Locale[] = ['en', 'ms', 'zh-CN', 'ta'];
export const STORAGE_KEY = 'opsfinance-locale';

export function resolveLocale(value?: string | null): Locale {
  if (!value) return getBrowserLocale();

  const normalized = value.trim().toLowerCase();
  if (normalized === 'en' || normalized === 'en-us') return 'en';
  if (normalized === 'ms' || normalized === 'ms-my') return 'ms';
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-cn-cn') return 'zh-CN';
  if (normalized === 'ta' || normalized === 'ta-my') return 'ta';

  return getBrowserLocale();
}

export function getBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;

  const candidate = navigator.language || navigator.languages?.[0] || '';
  const normalized = candidate.toLowerCase();
  if (normalized.startsWith('ms')) return 'ms';
  if (normalized.startsWith('zh')) return 'zh-CN';
  if (normalized.startsWith('ta')) return 'ta';
  return 'en';
}

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return resolveLocale(stored);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function persistLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore storage failures to keep the app usable.
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  ms: 'Bahasa Melayu',
  'zh-CN': '简体中文',
  ta: 'தமிழ்',
};

export type TranslationKey =
  | 'language'
  | 'languageSelector'
  | 'email'
  | 'password'
  | 'signIn'
  | 'signingIn'
  | 'forgotPassword'
  | 'register'
  | 'createAccount'
  | 'creatingAccount'
  | 'alreadyHaveAccount'
  | 'currentBusiness'
  | 'noActiveBusiness'
  | 'myAccount'
  | 'toggleNavigation'
  | 'backToMyOps'
  | 'overview'
  | 'dashboard'
  | 'allTransactions'
  | 'moneyIn'
  | 'moneyOut'
  | 'transfer'
  | 'journalEntry'
  | 'financialAccounts'
  | 'chartOfAccounts'
  | 'bankStatement'
  | 'invoiceBill'
  | 'receipt'
  | 'bankReconciliation'
  | 'profitLoss'
  | 'balanceSheet'
  | 'trialBalance'
  | 'generalLedger'
  | 'accountStatement'
  | 'businessProfile'
  | 'bankAccountSettings'
  | 'accountingSettings'
  | 'accountingRules'
  | 'accountCreated'
  | 'signedInSuccessfully'
  | 'provideBothEmailAndPassword'
  | 'supabaseNotConfigured'
  | 'noActiveSessionReturned'
  | 'provideNameEmailPassword'
  | 'accountCreatedCheckEmail'
  | 'registerHeading'
  | 'registerDescription'
  | 'name'
  | 'createYourWorkspace'
  | 'loginHeading'
  | 'liftYourFinance'
  | 'registerToStart'
  | 'logoutMessage';

export const translations: Record<Locale, Record<TranslationKey, string>> = {
  en: {
    language: 'Language',
    languageSelector: 'Select language',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in...',
    forgotPassword: 'Forgot Password',
    register: 'Register / Create Account',
    createAccount: 'Create account',
    creatingAccount: 'Creating account...',
    alreadyHaveAccount: 'Already have an account?',
    currentBusiness: 'Current business',
    noActiveBusiness: 'No active business',
    myAccount: 'My account',
    toggleNavigation: 'Toggle navigation',
    backToMyOps: 'Back to MYOPS',
    overview: 'Overview',
    dashboard: 'Dashboard',
    allTransactions: 'All Transactions',
    moneyIn: 'Money In',
    moneyOut: 'Money Out',
    transfer: 'Transfer',
    journalEntry: 'Journal Entry',
    financialAccounts: 'Financial Accounts',
    chartOfAccounts: 'Chart of Accounts',
    bankStatement: 'Bank Statement',
    invoiceBill: 'Invoice / Bill',
    receipt: 'Receipt',
    bankReconciliation: 'Bank Reconciliation',
    profitLoss: 'Profit & Loss',
    balanceSheet: 'Balance Sheet',
    trialBalance: 'Trial Balance',
    generalLedger: 'General Ledger',
    accountStatement: 'Account Statement',
    businessProfile: 'Business Profile',
    bankAccountSettings: 'Bank Account Settings',
    accountingSettings: 'Accounting Settings',
    accountingRules: 'Accounting Rules',
    accountCreated: 'Account created successfully.',
    signedInSuccessfully: 'Signed in successfully.',
    provideBothEmailAndPassword: 'Please provide both email and password.',
    supabaseNotConfigured: 'Supabase is not configured in this environment.',
    noActiveSessionReturned: 'No active session was returned. Please try again.',
    provideNameEmailPassword: 'Please provide your name, email, and password.',
    accountCreatedCheckEmail: 'Account created. Please check your email to confirm your account before signing in.',
    registerHeading: 'Create account',
    registerDescription: 'Register to start using OpsFinance.',
    name: 'Name',
    createYourWorkspace: 'Build a clearer financial picture.',
    loginHeading: 'Login',
    liftYourFinance: 'OpsFinance',
    registerToStart: 'Register to start using OpsFinance.',
    logoutMessage: 'Session expired. Returning to MYOPS login…',
  },
  ms: {
    language: 'Bahasa',
    languageSelector: 'Pilih bahasa',
    email: 'E-mel',
    password: 'Kata laluan',
    signIn: 'Log masuk',
    signingIn: 'Sedang log masuk...',
    forgotPassword: 'Lupa Kata Laluan',
    register: 'Daftar / Buat Akaun',
    createAccount: 'Buat akaun',
    creatingAccount: 'Membuat akaun...',
    alreadyHaveAccount: 'Sudah mempunyai akaun?',
    currentBusiness: 'Perniagaan semasa',
    noActiveBusiness: 'Tiada perniagaan aktif',
    myAccount: 'Akaun saya',
    toggleNavigation: 'Togol navigasi',
    backToMyOps: 'Kembali ke MYOPS',
    overview: 'Gambaran Keseluruhan',
    dashboard: 'Papan Pemuka',
    allTransactions: 'Semua Urus Niaga',
    moneyIn: 'Wang Masuk',
    moneyOut: 'Wang Keluar',
    transfer: 'Pemindahan',
    journalEntry: 'Catatan Jurnal',
    financialAccounts: 'Akaun Kewangan',
    chartOfAccounts: 'Carta Akaun',
    bankStatement: 'Penyata Bank',
    invoiceBill: 'Invois / Bil',
    receipt: 'Resit',
    bankReconciliation: 'Penyelarasan Bank',
    profitLoss: 'Untung & Rugi',
    balanceSheet: 'Kunci Kira-Kira',
    trialBalance: 'Neraca Percubaan',
    generalLedger: 'Lejar Am',
    accountStatement: 'Penyata Akaun',
    businessProfile: 'Profil Perniagaan',
    bankAccountSettings: 'Tetapan Akaun Bank',
    accountingSettings: 'Tetapan Perakaunan',
    accountingRules: 'Peraturan Perakaunan',
    accountCreated: 'Akaun berjaya dicipta.',
    signedInSuccessfully: 'Log masuk berjaya.',
    provideBothEmailAndPassword: 'Sila nyatakan e-mel dan kata laluan.',
    supabaseNotConfigured: 'Supabase belum dikonfigurasikan dalam persekitaran ini.',
    noActiveSessionReturned: 'Tiada sesi aktif dikembalikan. Sila cuba lagi.',
    provideNameEmailPassword: 'Sila berikan nama, e-mel dan kata laluan anda.',
    accountCreatedCheckEmail: 'Akaun dicipta. Sila semak e-mel anda untuk mengesahkan akaun sebelum log masuk.',
    registerHeading: 'Buat akaun',
    registerDescription: 'Daftar untuk mula menggunakan OpsFinance.',
    name: 'Nama',
    createYourWorkspace: 'Bina gambaran kewangan yang lebih jelas.',
    loginHeading: 'Log masuk',
    liftYourFinance: 'OpsFinance',
    registerToStart: 'Daftar untuk mula menggunakan OpsFinance.',
    logoutMessage: 'Sesi tamat. Mengembalikan ke log masuk MYOPS…',
  },
  'zh-CN': {
    language: '语言',
    languageSelector: '选择语言',
    email: '电子邮件',
    password: '密码',
    signIn: '登录',
    signingIn: '登录中...',
    forgotPassword: '忘记密码',
    register: '注册 / 创建账户',
    createAccount: '创建账户',
    creatingAccount: '创建账户中...',
    alreadyHaveAccount: '已有账号？',
    currentBusiness: '当前业务',
    noActiveBusiness: '暂无有效业务',
    myAccount: '我的账户',
    toggleNavigation: '切换导航',
    backToMyOps: '返回 MYOPS',
    overview: '概览',
    dashboard: '仪表板',
    allTransactions: '所有交易',
    moneyIn: '收入',
    moneyOut: '支出',
    transfer: '转账',
    journalEntry: '日记账分录',
    financialAccounts: '财务账户',
    chartOfAccounts: '账户科目表',
    bankStatement: '银行对账单',
    invoiceBill: '发票 / 账单',
    receipt: '收据',
    bankReconciliation: '银行对账',
    profitLoss: '利润与亏损',
    balanceSheet: '资产负债表',
    trialBalance: '试算平衡表',
    generalLedger: '总账',
    accountStatement: '账户明细',
    businessProfile: '业务资料',
    bankAccountSettings: '银行账户设置',
    accountingSettings: '会计设置',
    accountingRules: '会计规则',
    accountCreated: '账户创建成功。',
    signedInSuccessfully: '登录成功。',
    provideBothEmailAndPassword: '请输入电子邮件和密码。',
    supabaseNotConfigured: '当前环境未配置 Supabase。',
    noActiveSessionReturned: '未返回有效会话。请重试。',
    provideNameEmailPassword: '请提供您的姓名、电子邮件和密码。',
    accountCreatedCheckEmail: '账户已创建。请检查邮箱以确认账户，再进行登录。',
    registerHeading: '创建账户',
    registerDescription: '注册以开始使用 OpsFinance。',
    name: '姓名',
    createYourWorkspace: '建立更清晰的财务视图。',
    loginHeading: '登录',
    liftYourFinance: 'OpsFinance',
    registerToStart: '注册以开始使用 OpsFinance。',
    logoutMessage: '会话已过期，正在返回 MYOPS 登录页…',
  },
  ta: {
    language: 'மொழி',
    languageSelector: 'மொழியைத் தேர்ந்தெடுக்கவும்',
    email: 'மின்னஞ்சல்',
    password: 'கடவுச்சொல்',
    signIn: 'உள்நுழைக',
    signingIn: 'உள்நுழைகிறது...',
    forgotPassword: 'கடவுச்சொல்லை மறந்துவிட்டீர்களா?',
    register: 'பதிவு / கணக்கை உருவாக்கவும்',
    createAccount: 'கணக்கை உருவாக்கவும்',
    creatingAccount: 'கணக்கை உருவாக்குகிறது...',
    alreadyHaveAccount: 'ஏற்கனவே கணக்கு உள்ளதா?',
    currentBusiness: 'நடப்பு வணிகம்',
    noActiveBusiness: 'செயல்பாட்டில் உள்ள வணிகம் இல்லை',
    myAccount: 'என் கணக்கு',
    toggleNavigation: 'வழிசெலுத்தலை மாற்றுக',
    backToMyOps: 'MYOPS-க்கு திரும்பு',
    overview: 'கண்ணோட்டம்',
    dashboard: 'டாஷ்போர்டு',
    allTransactions: 'அனைத்து பரிவர்த்தனைகள்',
    moneyIn: 'செலுத்துதல்',
    moneyOut: 'செலுத்தியவை',
    transfer: 'மாற்றம்',
    journalEntry: 'ஜர்னல் பதிவு',
    financialAccounts: 'நிதி கணக்குகள்',
    chartOfAccounts: 'கணக்கு விளக்கப்படம்',
    bankStatement: 'வங்கி அறிக்கை',
    invoiceBill: 'விலைப்பட்டியல் / பில்',
    receipt: 'ரசீது',
    bankReconciliation: 'வங்கி இணைப்பு',
    profitLoss: 'லாபம் & நட்டம்',
    balanceSheet: 'இருப்புப் பட்டியல்',
    trialBalance: 'சோதனை இருப்புப் பட்டியல்',
    generalLedger: 'பொது கணக்கு வழக்கு',
    accountStatement: 'கணக்கு அறிக்கை',
    businessProfile: 'வணிக விவரம்',
    bankAccountSettings: 'வங்கி கணக்கு அமைப்புகள்',
    accountingSettings: 'நிதி அமைப்புகள்',
    accountingRules: 'நிதி விதிகள்',
    accountCreated: 'கணக்கு வெற்றிகரமாக உருவாக்கப்பட்டது.',
    signedInSuccessfully: 'உள்நுழைவு வெற்றிகரமாக முடிந்தது.',
    provideBothEmailAndPassword: 'மின்னஞ்சல் மற்றும் கடவுச்சொல்லை வழங்கவும்.',
    supabaseNotConfigured: 'இந்த சூழலில் Supabase கட்டமைக்கப்படவில்லை.',
    noActiveSessionReturned: 'செயல்பாட்டில் உள்ள அமர்வு திரும்பவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.',
    provideNameEmailPassword: 'உங்கள் பெயர், மின்னஞ்சல் மற்றும் கடவுச்சொல்லை வழங்கவும்.',
    accountCreatedCheckEmail: 'கணக்கு உருவாக்கப்பட்டது. உள்நுழைவதற்கு முன் உங்கள் மின்னஞ்சலைச் சரிபார்க்கவும்.',
    registerHeading: 'கணக்கை உருவாக்கவும்',
    registerDescription: 'OpsFinance-ஐப் பயன்படுத்த பதிவு செய்யுங்கள்.',
    name: 'பெயர்',
    createYourWorkspace: 'விளக்கமான நிதி காட்சியை உருவாக்குங்கள்.',
    loginHeading: 'உள்நுழை',
    liftYourFinance: 'OpsFinance',
    registerToStart: 'OpsFinance-ஐப் பயன்படுத்த பதிவு செய்யுங்கள்.',
    logoutMessage: 'அமர்வு முடிந்துவிட்டது. MYOPS உள்நுழைவுக்கு திரும்புகிறது…',
  },
};

export function getTranslation(locale: Locale | string | null | undefined, key: TranslationKey): string {
  const normalizedLocale = resolveLocale(locale);
  return translations[normalizedLocale]?.[key] ?? translations[DEFAULT_LOCALE][key];
}

export function getNavigationGroups(locale: Locale | string | null | undefined) {
  const normalizedLocale = resolveLocale(locale);
  const t = translations[normalizedLocale];

  return [
    { title: t.overview, items: [{ href: '/dashboard', label: t.dashboard }] },
    {
      title: 'Transactions',
      items: [
        { href: '/transactions', label: t.allTransactions },
        { href: '/transactions/money-in', label: t.moneyIn },
        { href: '/transactions/money-out', label: t.moneyOut },
        { href: '/transactions/transfer', label: t.transfer },
        { href: '/transactions/journal', label: t.journalEntry },
      ],
    },
    {
      title: 'Accounting',
      items: [
        { href: '/accounts/financial', label: t.financialAccounts },
        { href: '/accounts/chart', label: t.chartOfAccounts },
      ],
    },
    {
      title: 'Upload & Convert',
      items: [
        { href: '/upload', label: t.bankStatement },
        { href: '/upload', label: t.invoiceBill },
        { href: '/upload', label: t.receipt },
        { href: '/reconciliation', label: t.bankReconciliation },
      ],
    },
    {
      title: 'Reports',
      items: [
        { href: '/reports/profit-loss', label: t.profitLoss },
        { href: '/reports/balance-sheet', label: t.balanceSheet },
        { href: '/reports/trial-balance', label: t.trialBalance },
        { href: '/reports/general-ledger', label: t.generalLedger },
        { href: '/reports/account-statement', label: t.accountStatement },
      ],
    },
    {
      title: 'Settings',
      items: [
        { href: '/settings/business', label: t.businessProfile },
        { href: '/accounts/financial', label: t.bankAccountSettings },
        { href: '/settings/accounting', label: t.accountingSettings },
        { href: '/settings/accounting-rules', label: t.accountingRules },
      ],
    },
  ];
}

export function getMissingTranslationKeys(): string[] {
  const keys = new Set<TranslationKey>();
  for (const locale of SUPPORTED_LOCALES) {
    for (const key of Object.keys(translations[locale]) as TranslationKey[]) {
      keys.add(key);
    }
  }

  const allKeys = Object.keys(translations[DEFAULT_LOCALE]) as TranslationKey[];
  return allKeys.filter((key) =>
    SUPPORTED_LOCALES.some((locale) => !Object.prototype.hasOwnProperty.call(translations[locale], key)),
  );
}
