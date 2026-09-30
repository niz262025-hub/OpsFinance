export type BusinessRecord = {
  id: string;
  name: string;
  ownerId?: string | null;
  userIds?: string[];
};

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

  if (authorized.length === 1) {
    return authorized[0];
  }

  return authorized[0];
}
