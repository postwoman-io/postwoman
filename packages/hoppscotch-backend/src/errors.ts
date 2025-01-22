export const INVALID_EMAIL = 'invalid/email' as const;

export const EMAIL_FAILED = 'email/failed' as const;
export const DUPLICATE_EMAIL = 'email/both_emails_cannot_be_same' as const;

/**
 * Only one admin account found in infra
 * (AdminService)
 */
export const ONLY_ONE_ADMIN_ACCOUNT =
  'admin/only_one_admin_account_found' as const;

/**
 * Admin user can not be deleted
 * To delete the admin user, first make the Admin user a normal user
 * (AdminService)
 */
export const ADMIN_CAN_NOT_BE_DELETED =
  'admin/admin_can_not_be_deleted' as const;

/**
 * Token Authorization failed (Check 'Authorization' Header)
 * (GqlAuthGuard)
 */
export const AUTH_FAIL = 'auth/fail';

/**
 * Invalid JSON
 * (Utils)
 */
export const JSON_INVALID = 'json_invalid';

/**
 * Auth Provider not specified
 * (Auth)
 */
export const AUTH_PROVIDER_NOT_SPECIFIED = 'auth/provider_not_specified';

/**
 * Auth Provider not specified
 * (Auth)
 */
export const AUTH_PROVIDER_NOT_CONFIGURED =
  'auth/provider_not_configured_correctly';

/**
 * Environment variable "VITE_ALLOWED_AUTH_PROVIDERS" is not present in .env file
 */
export const ENV_NOT_FOUND_KEY_AUTH_PROVIDERS =
  '"VITE_ALLOWED_AUTH_PROVIDERS" is not present in .env file';

/**
 * Environment variable "DATA_ENCRYPTION_KEY" is not present in .env file
 */
export const ENV_NOT_FOUND_KEY_DATA_ENCRYPTION_KEY =
  '"DATA_ENCRYPTION_KEY" is not present in .env file';

/**
 * Environment variable "DATA_ENCRYPTION_KEY" is changed in .env file
 */
export const ENV_INVALID_DATA_ENCRYPTION_KEY =
  '"DATA_ENCRYPTION_KEY" value changed in .env file. Please undo the changes and restart the server';

/**
 * Environment variable "VITE_ALLOWED_AUTH_PROVIDERS" is empty in .env file
 */
export const ENV_EMPTY_AUTH_PROVIDERS =
  '"VITE_ALLOWED_AUTH_PROVIDERS" is empty in .env file';

/**
 * Environment variable "VITE_ALLOWED_AUTH_PROVIDERS" contains unsupported provider in .env file
 */
export const ENV_NOT_SUPPORT_AUTH_PROVIDERS =
  '"VITE_ALLOWED_AUTH_PROVIDERS" contains an unsupported auth provider in .env file';

/**
 * Tried to delete a user data document from fb firestore but failed.
 * (FirebaseService)
 */
export const USER_FB_DOCUMENT_DELETION_FAILED =
  'fb/firebase_document_deletion_failed' as const;

/**
 * Tried to do an action on a user where user is not found
 */
export const USER_NOT_FOUND = 'user/not_found' as const;

/**
 * User is already invited by admin
 */
export const USER_ALREADY_INVITED = 'admin/user_already_invited' as const;

/**
 * User update failure
 * (UserService)
 */
export const USER_UPDATE_FAILED = 'user/update_failed' as const;

/**
 * User display name validation failure
 * (UserService)
 */
export const USER_SHORT_DISPLAY_NAME = 'user/short_display_name' as const;

/**
 * User deletion failure
 * (UserService)
 */
export const USER_DELETION_FAILED = 'user/deletion_failed' as const;

/**
 * Users not found
 * (UserService)
 */
export const USERS_NOT_FOUND = 'user/users_not_found' as const;

/**
 * User deletion failure error due to user being a team owner
 * (UserService)
 */
export const USER_IS_OWNER = 'user/is_owner' as const;
/**
 * User deletion failure error due to user being an admin
 * (UserService)
 */
export const USER_IS_ADMIN = 'user/is_admin' as const;

/**
 * User invite deletion failure error due to invitation not found
 * (AdminService)
 */
export const USER_INVITATION_DELETION_FAILED =
  'user/invitation_deletion_failed' as const;

/**
 * Teams not found
 * (TeamsService)
 */
export const TEAMS_NOT_FOUND = 'user/teams_not_found' as const;

/**
 * Tried to find user collection but failed
 * (UserRequestService)
 */
export const USER_COLLECTION_NOT_FOUND = 'user_collection/not_found' as const;

/**
 * Tried to reorder user request but failed
 * (UserRequestService)
 */
export const USER_REQUEST_CREATION_FAILED =
  'user_request/creation_failed' as const;

/**
 * Tried to do an action on a user request but user request is not matched with user collection
 * (UserRequestService)
 */
export const USER_REQUEST_INVALID_TYPE = 'user_request/type_mismatch' as const;

/**
 * Tried to do an action on a user request where user request is not found
 * (UserRequestService)
 */
export const USER_REQUEST_NOT_FOUND = 'user_request/not_found' as const;

/**
 * Tried to reorder user request but failed
 * (UserRequestService)
 */
export const USER_REQUEST_REORDERING_FAILED =
  'user_request/reordering_failed' as const;

/**
 * Tried to perform action on a team which they are not a member of
 * (GqlTeamMemberGuard)
 */
export const TEAM_MEMBER_NOT_FOUND = 'team/member_not_found' as const;

/**
 * Tried to perform action on a team that doesn't accept their member role level
 * (GqlTeamMemberGuard)
 */
export const TEAM_NOT_REQUIRED_ROLE = 'team/not_required_role' as const;

/**
 * Team name validation failure
 * (TeamService)
 */
export const TEAM_NAME_INVALID = 'team/name_invalid';

/**
 * Couldn't find the sync data from the user
 * (TeamCollectionService)
 */
export const TEAM_USER_NO_FB_SYNCDATA = 'team/user_no_fb_syncdata';

/**
 * There was a problem resolving the firebase collection path
 * (TeamCollectionService)
 */
export const TEAM_FB_COLL_PATH_RESOLVE_FAIL = 'team/fb_coll_path_resolve_fail';

/**
 * Could not find the team in the database
 * (TeamCollectionService)
 */
export const TEAM_COLL_NOT_FOUND = 'team_coll/collection_not_found';

/**
 * Cannot make parent collection a child of a collection that a child of itself
 * (TeamCollectionService)
 */
export const TEAM_COLL_IS_PARENT_COLL = 'team_coll/collection_is_parent_coll';

/**
 * Target and Parent collections are not from the same team
 * (TeamCollectionService)
 */
export const TEAM_COLL_NOT_SAME_TEAM = 'team_coll/collections_not_same_team';

/**
 * Target and Parent collections are the same
 * (TeamCollectionService)
 */
export const TEAM_COLL_DEST_SAME =
  'team_coll/target_and_destination_collection_are_same';

/**
 * Collection is already a root collection
 * (TeamCollectionService)
 */
export const TEAM_COL_ALREADY_ROOT =
  'team_coll/target_collection_is_already_root_collection';

/**
 * Collections have different parents
 * (TeamCollectionService)
 */
export const TEAM_COL_NOT_SAME_PARENT =
  'team_coll/team_collections_have_different_parents';

/**
 * Collection and next Collection are the same
 * (TeamCollectionService)
 */
export const TEAM_COL_SAME_NEXT_COLL =
  'team_coll/collection_and_next_collection_are_same';

/**
 * Team Collection search failed
 * (TeamCollectionService)
 */
export const TEAM_COL_SEARCH_FAILED = 'team_coll/team_collection_search_failed';

/**
 * Team Collection Re-Ordering Failed
 * (TeamCollectionService)
 */
export const TEAM_COL_REORDERING_FAILED = 'team_coll/reordering_failed';

/**
 * Tried to update the team to a state it doesn't have any owners
 * (TeamService)
 */
export const TEAM_ONLY_ONE_OWNER = 'team/only_one_owner';

/**
 * Invalid or non-existent Team ID
 * (TeamService)
 */
export const TEAM_INVALID_ID = 'team/invalid_id' as const;

/**
 * Invalid or non-existent collection id
 * (GqlCollectionTeamMemberGuard)
 */
export const TEAM_INVALID_COLL_ID = 'team/invalid_coll_id' as const;

/**
 * Invalid team id or user id
 * (TeamService)
 */
export const TEAM_INVALID_ID_OR_USER = 'team/invalid_id_or_user';

/**
 * The provided title for the team collection is short (less than 3 characters)
 * (TeamCollectionService)
 */
export const TEAM_COLL_SHORT_TITLE = 'team_coll/short_title';

/**
 * The JSON used is not valid
 * (TeamCollectionService)
 */
export const TEAM_COLL_INVALID_JSON = 'team_coll/invalid_json';

/**
 * The Team Collection does not belong to the team
 * (TeamCollectionService)
 */
export const TEAM_NOT_OWNER = 'team_coll/team_not_owner' as const;

/**
 * The Team Collection data is not valid
 * (TeamCollectionService)
 */
export const TEAM_COLL_DATA_INVALID =
  'team_coll/team_coll_data_invalid' as const;

/**
 * Team Collection parent tree generation failed
 * (TeamCollectionService)
 */
export const TEAM_COLL_PARENT_TREE_GEN_FAILED =
  'team_coll/team_coll_parent_tree_generation_failed';

/**
 * Tried to perform an action on a request that doesn't accept their member role level
 * (GqlRequestTeamMemberGuard)
 */
export const TEAM_REQ_NOT_REQUIRED_ROLE = 'team_req/not_required_role';

/**
 * Tried to operate on a request which does not exist
 * (TeamRequestService)
 */
export const TEAM_REQ_NOT_FOUND = 'team_req/not_found' as const;

/**
 * Invalid or non-existent collection id
 * (TeamRequestService)
 */
export const TEAM_REQ_INVALID_TARGET_COLL_ID =
  'team_req/invalid_target_id' as const;

/**
 * Tried to reorder team request but failed
 * (TeamRequestService)
 */
export const TEAM_REQ_REORDERING_FAILED = 'team_req/reordering_failed' as const;

/**
 * Team Request search failed
 * (TeamRequestService)
 */
export const TEAM_REQ_SEARCH_FAILED = 'team_req/team_request_search_failed';

/**
 * Team Request parent tree generation failed
 * (TeamRequestService)
 */
export const TEAM_REQ_PARENT_TREE_GEN_FAILED =
  'team_req/team_req_parent_tree_generation_failed';

/**
 * No Postmark Sender Email defined
 * (AuthService)
 */
export const SENDER_EMAIL_INVALID = 'mailer/sender_email_invalid' as const;

/**
 * Tried to perform an action on a request when the user is not even a member of the team
 * (GqlRequestTeamMemberGuard, GqlCollectionTeamMemberGuard)
 */
export const TEAM_REQ_NOT_MEMBER = 'team_req/not_member';

export const TEAM_INVITE_MEMBER_HAS_INVITE =
  'team_invite/member_has_invite' as const;

export const TEAM_INVITE_NO_INVITE_FOUND =
  'team_invite/no_invite_found' as const;

export const TEAM_INVITE_ALREADY_MEMBER = 'team_invite/already_member' as const;

export const TEAM_INVITE_EMAIL_DO_NOT_MATCH =
  'team_invite/email_do_not_match' as const;

export const TEAM_INVITE_NOT_VALID_VIEWER =
  'team_invite/not_valid_viewer' as const;

/**
 * No team invitations found
 * (TeamInvitationService)
 */
export const TEAM_INVITATION_NOT_FOUND =
  'team_invite/invitations_not_found' as const;

/**
 * ShortCode not found in DB
 * (ShortcodeService)
 */
export const SHORTCODE_NOT_FOUND = 'shortcode/not_found' as const;

/**
 * Invalid or non-existent TEAM ENVIRONMENT ID
 * (TeamEnvironmentsService)
 */
export const TEAM_ENVIRONMENT_NOT_FOUND = 'team_environment/not_found' as const;

/**
 * Invalid TEAM ENVIRONMENT name
 * (TeamEnvironmentsService)
 */
export const TEAM_ENVIRONMENT_SHORT_NAME =
  'team_environment/short_name' as const;

/**
 * The user is not a member of the team of the given environment
 * (GqlTeamEnvTeamGuard)
 */
export const TEAM_ENVIRONMENT_NOT_TEAM_MEMBER =
  'team_environment/not_team_member' as const;

/**
 * User setting not found for a user
 * (UserSettingsService)
 */
export const USER_SETTINGS_NOT_FOUND = 'user_settings/not_found' as const;

/**
 * User setting already exists for a user
 * (UserSettingsService)
 */
export const USER_SETTINGS_ALREADY_EXISTS =
  'user_settings/settings_already_exists' as const;

/**
 * User setting invalid (null) settings
 * (UserSettingsService)
 */
export const USER_SETTINGS_NULL_SETTINGS =
  'user_settings/null_settings' as const;

/*
 * Global environment doesn't exist for the user
 * (UserEnvironmentsService)
 */
export const USER_ENVIRONMENT_GLOBAL_ENV_DOES_NOT_EXISTS =
  'user_environment/global_env_does_not_exists' as const;

/**
 * Global environment already exists for the user
 * (UserEnvironmentsService)
 */
export const USER_ENVIRONMENT_GLOBAL_ENV_EXISTS =
  'user_environment/global_env_already_exists' as const;
/*

/**
 * User environment doesn't exist for the user
 * (UserEnvironmentsService)
 */
export const USER_ENVIRONMENT_ENV_DOES_NOT_EXISTS =
  'user_environment/user_env_does_not_exists' as const;
/*

/**
 * Cannot delete the global user environment
 * (UserEnvironmentsService)
 */
export const USER_ENVIRONMENT_GLOBAL_ENV_DELETION_FAILED =
  'user_environment/user_env_global_env_deletion_failed' as const;
/*

/**
 * User environment is not a global environment
 * (UserEnvironmentsService)
 */
export const USER_ENVIRONMENT_IS_NOT_GLOBAL =
  'user_environment/user_env_is_not_global' as const;
/*

/**
 * User environment update failed
 * (UserEnvironmentsService)
 */
export const USER_ENVIRONMENT_UPDATE_FAILED =
  'user_environment/user_env_update_failed' as const;
/*

/**
 * User environment invalid environment name
 * (UserEnvironmentsService)
 */
export const USER_ENVIRONMENT_INVALID_ENVIRONMENT_NAME =
  'user_environment/user_env_invalid_env_name' as const;
/*

/**
 * User history not found
 * (UserHistoryService)
 */
export const USER_HISTORY_NOT_FOUND = 'user_history/history_not_found' as const;

/**
 * User history deletion failed
 * (UserHistoryService)
 */
export const USER_HISTORY_DELETION_FAILED =
  'user_history/deletion_failed' as const;

/**
 * User history feature flag is disabled
 * (UserHistoryService)
 */
export const USER_HISTORY_FEATURE_FLAG_DISABLED =
  'user_history/feature_flag_disabled';

/**
 * Invalid Request Type in History
 * (UserHistoryService)
 */
export const USER_HISTORY_INVALID_REQ_TYPE =
  'user_history/req_type_invalid' as const;

/*

 |------------------------------------|
 |Server errors that are actually bugs|
 |------------------------------------|

*/

/**
 * Couldn't find user data from the GraphQL context (Check if GqlAuthGuard is applied)
 * (GqlTeamMemberGuard, GqlCollectionTeamMemberGuard)
 */
export const BUG_AUTH_NO_USER_CTX = 'bug/auth/auth_no_user_ctx' as const;

/**
 * Couldn't find teamID parameter in the attached GraphQL operation. (Check if teamID is present)
 * (GqlTeamMemberGuard, GQLEAAdminGuard, GqlCollectionTeamMemberGuard)
 */
export const BUG_TEAM_NO_TEAM_ID = 'bug/team/no_team_id';

/**
 * Couldn't find RequireTeamRole decorator. (Check if it is applied)
 * (GqlTeamMemberGuard)
 */
export const BUG_TEAM_NO_REQUIRE_TEAM_ROLE = 'bug/team/no_require_team_role';

/**
 * Couldn't find 'collectionID' param to the attached GQL operation. (Check if exists)
 * (GqlCollectionTeamMemberGuard)
 */
export const BUG_TEAM_COLL_NO_COLL_ID = 'bug/team_coll/no_coll_id';

/**
 * Couldn't find 'requestID' param to the attached GQL operation. (Check if exists)
 * (GqlRequestTeamMemberGuard)
 */
export const BUG_TEAM_REQ_NO_REQ_ID = 'bug/team_req/no_req_id';

export const BUG_TEAM_INVITE_NO_INVITE_ID =
  'bug/team_invite/no_invite_id' as const;

/**
 * Couldn't find RequireTeamRole decorator. (Check if it is applied)
 * (GqlTeamEnvTeamGuard)
 */
export const BUG_TEAM_ENV_GUARD_NO_REQUIRE_ROLES =
  'bug/team_env/guard_no_require_roles' as const;

/**
 * Couldn't find 'id' param to the operation. (Check if it is applied)
 * (GqlTeamEnvTeamGuard)
 */
export const BUG_TEAM_ENV_GUARD_NO_ENV_ID =
  'bug/team_env/guard_no_env_id' as const;

/**
 * The data sent to the verify route are invalid
 * (AuthService)
 */
export const INVALID_MAGIC_LINK_DATA = 'auth/magic_link_invalid_data' as const;

/**
 * Could not find VerificationToken entry in the db
 * (AuthService)
 */
export const VERIFICATION_TOKEN_DATA_NOT_FOUND =
  'auth/verification_token_data_not_found' as const;

/**
 * Auth Tokens expired
 * (AuthService)
 */
export const TOKEN_EXPIRED = 'auth/token_expired' as const;

/**
 * VerificationToken Tokens expired i.e. magic-link expired
 * (AuthService)
 */
export const MAGIC_LINK_EXPIRED = 'auth/magic_link_expired' as const;

/**
 * No cookies were found in the auth request
 * (AuthService)
 */
export const COOKIES_NOT_FOUND = 'auth/cookies_not_found' as const;

/**
 * Access Token is malformed or invalid
 * (AuthService)
 */
export const INVALID_ACCESS_TOKEN = 'auth/invalid_access_token' as const;

/**
 * Refresh Token is malformed or invalid
 * (AuthService)
 */
export const INVALID_REFRESH_TOKEN = 'auth/invalid_refresh_token' as const;

/**
 * The provided title for the user collection is short (less than 3 characters)
 * (UserCollectionService)
 */
export const USER_COLL_SHORT_TITLE = 'user_coll/short_title' as const;

/**
 * User Collection could not be found
 * (UserCollectionService)
 */
export const USER_COLL_NOT_FOUND = 'user_coll/not_found' as const;

/**
 * UserCollection is already a root collection
 * (UserCollectionService)
 */
export const USER_COLL_ALREADY_ROOT =
  'user_coll/target_user_collection_is_already_root_user_collection' as const;

/**
 * Target and Parent user collections are the same
 * (UserCollectionService)
 */
export const USER_COLL_DEST_SAME =
  'user_coll/target_and_destination_user_collection_are_same' as const;

/**
 * Target and Parent user collections are not from the same user
 * (UserCollectionService)
 */
export const USER_COLL_NOT_SAME_USER = 'user_coll/not_same_user' as const;

/**
 * Target and Parent user collections are not from the same type
 * (UserCollectionService)
 */
export const USER_COLL_NOT_SAME_TYPE = 'user_coll/type_mismatch' as const;

/**
 * Cannot make a parent user collection a child of itself
 * (UserCollectionService)
 */
export const USER_COLL_IS_PARENT_COLL =
  'user_coll/user_collection_is_parent_coll' as const;

/**
 * User Collection Re-Ordering Failed
 * (UserCollectionService)
 */
export const USER_COLL_REORDERING_FAILED =
  'user_coll/reordering_failed' as const;

/**
 * The Collection and Next User Collection are the same
 * (UserCollectionService)
 */
export const USER_COLL_SAME_NEXT_COLL =
  'user_coll/user_collection_and_next_user_collection_are_same' as const;

/**
 * The User Collection data is not valid
 * (UserCollectionService)
 */
export const USER_COLL_DATA_INVALID =
  'user_coll/user_coll_data_invalid' as const;

/**
 * The User Collection does not belong to the logged-in user
 * (UserCollectionService)
 */
export const USER_NOT_OWNER = 'user_coll/user_not_owner' as const;

/**
 * The JSON used is not valid
 * (UserCollectionService)
 */
export const USER_COLL_INVALID_JSON = 'user_coll/invalid_json';

/*
 * MAILER_SMTP_URL environment variable is not defined
 * (MailerModule)
 */
export const MAILER_SMTP_URL_UNDEFINED = 'mailer/smtp_url_undefined' as const;

/**
 * MAILER_ADDRESS_FROM environment variable is not defined
 * (MailerModule)
 */
export const MAILER_FROM_ADDRESS_UNDEFINED =
  'mailer/from_address_undefined' as const;

/**
 * MAILER_SMTP_USER environment variable is not defined
 * (MailerModule)
 */
export const MAILER_SMTP_USER_UNDEFINED = 'mailer/smtp_user_undefined' as const;

/**
 * MAILER_SMTP_PASSWORD environment variable is not defined
 * (MailerModule)
 */
export const MAILER_SMTP_PASSWORD_UNDEFINED =
  'mailer/smtp_password_undefined' as const;

/**
 * SharedRequest invalid request JSON format
 * (ShortcodeService)
 */
export const SHORTCODE_INVALID_REQUEST_JSON =
  'shortcode/request_invalid_format' as const;

/**
 * SharedRequest invalid properties JSON format
 * (ShortcodeService)
 */
export const SHORTCODE_INVALID_PROPERTIES_JSON =
  'shortcode/properties_invalid_format' as const;

/**
 * SharedRequest invalid properties not found
 * (ShortcodeService)
 */
export const SHORTCODE_PROPERTIES_NOT_FOUND =
  'shortcode/properties_not_found' as const;

/**
 * Infra Config not found
 * (InfraConfigService)
 */
export const INFRA_CONFIG_NOT_FOUND = 'infra_config/not_found' as const;

/**
 * Infra Config update failed
 * (InfraConfigService)
 */
export const INFRA_CONFIG_UPDATE_FAILED = 'infra_config/update_failed' as const;

/**
 * Infra Config not listed for onModuleInit creation
 * (InfraConfigService)
 */
export const INFRA_CONFIG_NOT_LISTED =
  'infra_config/properly_not_listed' as const;

/**
 * Infra Config reset failed
 * (InfraConfigService)
 */
export const INFRA_CONFIG_RESET_FAILED = 'infra_config/reset_failed' as const;

/**
 * Infra Config invalid input for Config variable
 * (InfraConfigService)
 */
export const INFRA_CONFIG_INVALID_INPUT = 'infra_config/invalid_input' as const;

/**
 * Infra Config service (auth provider/mailer/audit logs) not configured
 * (InfraConfigService)
 */
export const INFRA_CONFIG_SERVICE_NOT_CONFIGURED =
  'infra_config/service_not_configured' as const;

/**
 * Infra Config update/fetch operation not allowed
 * (InfraConfigService)
 */
export const INFRA_CONFIG_OPERATION_NOT_ALLOWED =
  'infra_config/operation_not_allowed';

/**
 * Error message for when the database table does not exist
 * (InfraConfigService)
 */
export const DATABASE_TABLE_NOT_EXIST =
  'Database migration not found. Please check the documentation for assistance: https://docs.hoppscotch.io/documentation/self-host/community-edition/install-and-build#running-migrations';

/**
 * PostHog client is not initialized
 * (InfraConfigService)
 */
export const POSTHOG_CLIENT_NOT_INITIALIZED = 'posthog/client_not_initialized';

/**
 * Inputs supplied are invalid
 */
export const INVALID_PARAMS = 'invalid_parameters' as const;

/**
 * The provided label for the access-token is short (less than 3 characters)
 * (AccessTokenService)
 */
export const ACCESS_TOKEN_LABEL_SHORT = 'access_token/label_too_short';

/**
 * The provided expiryInDays value is not valid
 * (AccessTokenService)
 */
export const ACCESS_TOKEN_EXPIRY_INVALID = 'access_token/expiry_days_invalid';

/**
 * The provided PAT ID is invalid
 * (AccessTokenService)
 */
export const ACCESS_TOKEN_NOT_FOUND = 'access_token/access_token_not_found';

/**
 * AccessTokens is expired
 * (AccessTokenService)
 */
export const ACCESS_TOKEN_EXPIRED = 'TOKEN_EXPIRED';

/**
 * AccessTokens is invalid
 * (AccessTokenService)
 */
export const ACCESS_TOKEN_INVALID = 'TOKEN_INVALID';

/**
 * AccessTokens is invalid
 * (AccessTokenService)
 */
export const ACCESS_TOKENS_INVALID_DATA_ID = 'INVALID_ID';

/**
 * The provided label for the infra-token is short (less than 3 characters)
 * (InfraTokenService)
 */
export const INFRA_TOKEN_LABEL_SHORT = 'infra_token/label_too_short';

/**
 * The provided expiryInDays value is not valid
 * (InfraTokenService)
 */
export const INFRA_TOKEN_EXPIRY_INVALID = 'infra_token/expiry_days_invalid';

/**
 * The provided Infra Token ID is invalid
 * (InfraTokenService)
 */
export const INFRA_TOKEN_NOT_FOUND = 'infra_token/infra_token_not_found';

/**
 * Authorization missing in header (Check 'Authorization' Header)
 * (InfraTokenGuard)
 */
export const INFRA_TOKEN_HEADER_MISSING =
  'infra_token/authorization_token_missing';

/**
 * Infra Token is invalid
 * (InfraTokenGuard)
 */
export const INFRA_TOKEN_INVALID_TOKEN = 'infra_token/invalid_token';

/**
 * Infra Token is expired
 * (InfraTokenGuard)
 */
export const INFRA_TOKEN_EXPIRED = 'infra_token/expired';

/**
 * Token creator not found
 * (InfraTokenService)
 */
export const INFRA_TOKEN_CREATOR_NOT_FOUND = 'infra_token/creator_not_found';
