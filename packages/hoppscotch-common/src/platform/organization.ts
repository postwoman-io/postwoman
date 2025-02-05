export type OrganizationPlatformDef = {
  isDefaultCloudInstance: boolean
  getOrgInfo: () => Promise<{
    orgID: string
    orgDomain: string
  } | null>
  getRootDomain: () => string
}
