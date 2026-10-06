export type BusinessRecord = {
  id: string;
  name: string;
  ownerId?: string | null;
  userIds?: string[];
  registrationNo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  baseCurrency?: string | null;
  fiscalYearStart?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type BusinessContextState = 'AUTH_REQUIRED' | 'NO_BUSINESS' | 'UNAUTHORIZED_BUSINESS' | 'BUSINESS_CONTEXT_READY';

export type BusinessContext = {
  userId: string;
  businessId: string;
  role?: string | null;
  state: BusinessContextState;
};

export type BusinessContextResult = {
  business: BusinessRecord | null;
  memberships: BusinessRecord[];
  created: boolean;
  error: string | null;
  context?: BusinessContext | null;
};

export function normalizeBusinessMemberships(
  memberships: Array<string | { business_id?: string | null; businessId?: string | null }> | null | undefined,
): string[] {
  if (!Array.isArray(memberships)) {
    return [];
  }

  return memberships
    .map((member) => {
      if (typeof member === 'string') {
        return member.trim();
      }

      return (member?.business_id ?? member?.businessId ?? '').trim();
    })
    .filter((value): value is string => Boolean(value));
}

export function resolveAuthorizedBusinessId(
  userId: string | null | undefined,
  memberships: Array<string | { business_id?: string | null; businessId?: string | null }> | null | undefined,
  requestedBusinessId: string | null | undefined,
): string {
  if (!userId || !requestedBusinessId) {
    throw new Error('Business access denied.');
  }

  const authorizedBusinessIds = new Set(normalizeBusinessMemberships(memberships));
  if (!authorizedBusinessIds.has(requestedBusinessId)) {
    throw new Error('Business access denied.');
  }

  return requestedBusinessId;
}

export function selectCurrentBusiness(businesses: Array<BusinessRecord> | null | undefined, userId?: string | null): BusinessRecord | null {
  if (!userId || !Array.isArray(businesses) || businesses.length === 0) {
    return null;
  }

  const authorized = businesses.filter((business) => {
    const ownerMatches = business.ownerId === userId;
    const memberMatches = (business.userIds ?? []).includes(userId);
    return ownerMatches || memberMatches;
  });

  if (authorized.length === 0) {
    return null;
  }

  return authorized[0];
}

export async function resolveCurrentBusinessForUser(
  supabase: any,
  userId?: string | null,
): Promise<BusinessContextResult> {
  if (!userId) {
    return { business: null, memberships: [], created: false, error: 'Authenticated user required.', context: { userId: '', businessId: '', state: 'AUTH_REQUIRED' } };
  }

  const { data: membershipRows, error: membershipError } = await supabase
    .from('business_members')
    .select('business_id, role, businesses(id, name, registration_no, address, phone, email, base_currency, fiscal_year_start, created_at, updated_at)')
    .eq('user_id', userId);

  if (membershipError) {
    return { business: null, memberships: [], created: false, error: membershipError.message ?? 'Business lookup failed.', context: { userId, businessId: '', state: 'NO_BUSINESS' } };
  }

  const businesses = (membershipRows ?? [])
    .map((row: any) => row.businesses)
    .filter(Boolean)
    .map((business: any) => ({
      id: business.id,
      name: business.name,
      ownerId: null,
      userIds: [userId],
      registrationNo: business.registration_no ?? null,
      address: business.address ?? null,
      phone: business.phone ?? null,
      email: business.email ?? null,
      baseCurrency: business.base_currency ?? null,
      fiscalYearStart: business.fiscal_year_start ?? null,
      createdAt: business.created_at ?? null,
      updatedAt: business.updated_at ?? null,
    } as BusinessRecord));

  if (businesses.length === 0) {
    return { business: null, memberships: [], created: false, error: 'No authorized business found for this user.', context: { userId, businessId: '', state: 'NO_BUSINESS' } };
  }

  const currentBusiness = selectCurrentBusiness(businesses, userId);
  if (!currentBusiness) {
    return { business: null, memberships: businesses, created: false, error: 'No active business is linked to this user.', context: { userId, businessId: '', state: 'NO_BUSINESS' } };
  }

  const membership = (membershipRows ?? []).find((row: any) => row.business_id === currentBusiness.id);

  return {
    business: currentBusiness,
    memberships: businesses,
    created: false,
    error: null,
    context: {
      userId,
      businessId: currentBusiness.id,
      role: membership?.role ?? 'member',
      state: 'BUSINESS_CONTEXT_READY',
    },
  };
}

export async function resolveBusinessContextForUser(
  supabase: any,
  userId?: string | null,
  requestedBusinessId?: string | null,
): Promise<BusinessContext | null> {
  if (!userId) {
    return null;
  }

  const { data: membershipRows, error } = await supabase
    .from('business_members')
    .select('business_id, role')
    .eq('user_id', userId);

  if (error || !Array.isArray(membershipRows)) {
    return null;
  }

  const authorizedBusinessIds = new Set(
    membershipRows
      .map((row: any) => String(row.business_id ?? '').trim())
      .filter(Boolean),
  );

  const businessId = requestedBusinessId ? String(requestedBusinessId).trim() : null;
  if (businessId && !authorizedBusinessIds.has(businessId)) {
    return { userId, businessId: '', role: null, state: 'UNAUTHORIZED_BUSINESS' };
  }

  if (!businessId && authorizedBusinessIds.size === 0) {
    return { userId, businessId: '', role: null, state: 'NO_BUSINESS' };
  }

  const nextBusinessId = businessId ?? [...authorizedBusinessIds][0];
  const roleRow = (membershipRows ?? []).find((row: any) => String(row.business_id ?? '').trim() === nextBusinessId);
  return { userId, businessId: nextBusinessId, role: roleRow?.role ?? null, state: 'BUSINESS_CONTEXT_READY' };
}
