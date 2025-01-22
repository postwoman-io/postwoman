import {
  JSON_INVALID,
  USERS_NOT_FOUND,
  USER_NOT_FOUND,
  USER_SHORT_DISPLAY_NAME,
} from 'src/errors';
import { mockDeep, mockReset } from 'jest-mock-extended';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthUser } from 'src/types/AuthUser';
import { User } from './user.model';
import { UserService } from './user.service';
import { PubSubService } from 'src/pubsub/pubsub.service';
import * as TO from 'fp-ts/TaskOption';
import * as T from 'fp-ts/Task';

const mockPrisma = mockDeep<PrismaService>();
const mockPubSub = mockDeep<PubSubService>();
let service: UserService;

const handler1 = {
  canAllowUserDeletion: jest.fn(),
  onUserDelete: jest.fn(),
};

const handler2 = {
  canAllowUserDeletion: jest.fn(),
  onUserDelete: jest.fn(),
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const userService = new UserService(mockPrisma, mockPubSub as any);

const currentTime = new Date();

const user: AuthUser = {
  uid: '123344',
  email: 'dwight@dundermifflin.com',
  displayName: 'Dwight Schrute',
  photoURL: 'https://en.wikipedia.org/wiki/Dwight_Schrute',
  isAdmin: false,
  currentRESTSession: {},
  currentGQLSession: {},
  refreshToken: 'hbfvdkhjbvkdvdfjvbnkhjb',
  lastLoggedOn: currentTime,
  lastActiveOn: currentTime,
  createdOn: currentTime,
};

const adminUser: AuthUser = {
  uid: '123344',
  email: 'dwight@dundermifflin.com',
  displayName: 'Dwight Schrute',
  photoURL: 'https://en.wikipedia.org/wiki/Dwight_Schrute',
  isAdmin: true,
  currentRESTSession: {},
  currentGQLSession: {},
  refreshToken: 'hbfvdkhjbvkdvdfjvbnkhjb',
  lastLoggedOn: currentTime,
  lastActiveOn: currentTime,
  createdOn: currentTime,
};

const users: AuthUser[] = [
  {
    uid: '123344',
    email: 'dwight@dundermifflin.com',
    displayName: 'Dwight Schrute',
    photoURL: 'https://en.wikipedia.org/wiki/Dwight_Schrute',
    isAdmin: false,
    currentRESTSession: {},
    currentGQLSession: {},
    refreshToken: 'hbfvdkhjbvkdvdfjvbnkhjb',
    lastLoggedOn: currentTime,
    lastActiveOn: currentTime,
    createdOn: currentTime,
  },
  {
    uid: '5555',
    email: 'abc@dundermifflin.com',
    displayName: 'abc Schrute',
    photoURL: 'https://en.wikipedia.org/wiki/Dwight_Schrute',
    isAdmin: false,
    currentRESTSession: {},
    currentGQLSession: {},
    refreshToken: 'hbfvdkhjbvkdvdfjvbnkhjb',
    lastLoggedOn: currentTime,
    lastActiveOn: currentTime,
    createdOn: currentTime,
  },
  {
    uid: '6666',
    email: 'def@dundermifflin.com',
    displayName: 'def Schrute',
    photoURL: 'https://en.wikipedia.org/wiki/Dwight_Schrute',
    isAdmin: false,
    currentRESTSession: {},
    currentGQLSession: {},
    refreshToken: 'hbfvdkhjbvkdvdfjvbnkhjb',
    lastLoggedOn: currentTime,
    lastActiveOn: currentTime,
    createdOn: currentTime,
  },
];

const adminUsers: AuthUser[] = [
  {
    uid: '123344',
    email: 'dwight@dundermifflin.com',
    displayName: 'Dwight Schrute',
    photoURL: 'https://en.wikipedia.org/wiki/Dwight_Schrute',
    isAdmin: true,
    currentRESTSession: {},
    currentGQLSession: {},
    refreshToken: 'hbfvdkhjbvkdvdfjvbnkhjb',
    lastLoggedOn: currentTime,
    lastActiveOn: currentTime,
    createdOn: currentTime,
  },
  {
    uid: '5555',
    email: 'abc@dundermifflin.com',
    displayName: 'abc Schrute',
    photoURL: 'https://en.wikipedia.org/wiki/Dwight_Schrute',
    isAdmin: true,
    currentRESTSession: {},
    currentGQLSession: {},
    refreshToken: 'hbfvdkhjbvkdvdfjvbnkhjb',
    lastLoggedOn: currentTime,
    lastActiveOn: currentTime,
    createdOn: currentTime,
  },
  {
    uid: '6666',
    email: 'def@dundermifflin.com',
    displayName: 'def Schrute',
    photoURL: 'https://en.wikipedia.org/wiki/Dwight_Schrute',
    isAdmin: true,
    currentRESTSession: {},
    currentGQLSession: {},
    refreshToken: 'hbfvdkhjbvkdvdfjvbnkhjb',
    lastLoggedOn: currentTime,
    lastActiveOn: currentTime,
    createdOn: currentTime,
  },
];

const exampleSSOProfileData = {
  id: '123rfedvd',
  emails: [{ value: 'dwight@dundermifflin.com' }],
  displayName: 'Dwight Schrute',
  provider: 'google',
  photos: 'https://en.wikipedia.org/wiki/Dwight_Schrute',
};

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = '12345678901234567890123456789012';
});

afterAll(() => {
  delete process.env.DATA_ENCRYPTION_KEY; // Clean up after tests
});

beforeEach(() => {
  mockReset(mockPrisma);
  mockPubSub.publish.mockClear();
  service = new UserService(mockPrisma, mockPubSub as any);

  service.registerUserDataHandler(handler1);
  service.registerUserDataHandler(handler2);
});

describe('UserService', () => {
  describe('findUserByEmail', () => {
    test('should successfully return a valid user given a valid email', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(user);

      const result = await userService.findUserByEmail(
        'dwight@dundermifflin.com',
      );
      expect(result).toEqualSome(user);
    });

    test('should return a null user given a invalid email', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const result = await userService.findUserByEmail('jim@dundermifflin.com');
      expect(result).resolves.toBeNone;
    });
  });

  describe('findUserById', () => {
    test('should successfully return a valid user given a valid user uid', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValueOnce(user);

      const result = await userService.findUserById('123344');
      expect(result).toEqualSome(user);
    });

    test('should return a null user given a invalid user uid', async () => {
      mockPrisma.user.findUniqueOrThrow.mockRejectedValueOnce('NotFoundError');

      const result = await userService.findUserById('sdcvbdbr');
      expect(result).resolves.toBeNone;
    });
  });

  describe('findUsersByIds', () => {
    test('should successfully return users given valid user UIDs', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce(users);

      const result = await userService.findUsersByIds([
        '123344',
        '5555',
        '6666',
      ]);
      expect(result).toEqual(users);
    });

    test('should return empty array of users given a invalid user UIDs', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const result = await userService.findUsersByIds(['sdcvbdbr']);
      expect(result).toEqual([]);
    });
  });

  describe('createUserViaMagicLink', () => {
    test('should successfully create user and account for magic-link given valid inputs', async () => {
      mockPrisma.user.create.mockResolvedValueOnce(user);

      const result = await userService.createUserViaMagicLink(
        'dwight@dundermifflin.com',
      );
      expect(result).toEqual(user);
    });
  });

  describe('createUserSSO', () => {
    test('should successfully create user and account for SSO provider given valid inputs  ', async () => {
      mockPrisma.user.create.mockResolvedValueOnce(user);

      const result = await userService.createUserSSO(
        'sdcsdcsdc',
        'dscsdc',
        exampleSSOProfileData,
      );
      expect(result).toEqual(user);
    });

    test('should successfully create user and account for SSO provider given no displayName  ', async () => {
      mockPrisma.user.create.mockResolvedValueOnce({
        ...user,
        displayName: null,
      });

      const result = await userService.createUserSSO('sdcsdcsdc', 'dscsdc', {
        ...exampleSSOProfileData,
        displayName: null,
      });

      expect(result).toEqual({
        ...user,
        displayName: null,
      });
    });

    test('should successfully create user and account for SSO provider given no photoURL  ', async () => {
      mockPrisma.user.create.mockResolvedValueOnce({
        ...user,
        photoURL: null,
      });

      const result = await userService.createUserSSO('sdcsdcsdc', 'dscsdc', {
        ...exampleSSOProfileData,
        photoURL: null,
      });

      expect(result).toEqual({
        ...user,
        photoURL: null,
      });
    });
  });

  describe('createProviderAccount', () => {
    test('should successfully create ProviderAccount for user given valid inputs ', async () => {
      mockPrisma.account.create.mockResolvedValueOnce({
        id: '123dcdc',
        userId: user.uid,
        provider: exampleSSOProfileData.provider,
        providerAccountId: exampleSSOProfileData.id,
        providerRefreshToken: 'dscsdc',
        providerAccessToken: 'sdcsdcsdc',
        providerScope: 'user.email',
        loggedIn: currentTime,
      });

      const result = await userService.createProviderAccount(
        user,
        'sdcsdcsdc',
        'dscsdc',
        exampleSSOProfileData,
      );
      expect(result).toEqual({
        id: '123dcdc',
        userId: user.uid,
        provider: exampleSSOProfileData.provider,
        providerAccountId: exampleSSOProfileData.id,
        providerRefreshToken: 'dscsdc',
        providerAccessToken: 'sdcsdcsdc',
        providerScope: 'user.email',
        loggedIn: currentTime,
      });
    });

    test('should successfully create ProviderAccount for user given no accessToken ', async () => {
      mockPrisma.account.create.mockResolvedValueOnce({
        id: '123dcdc',
        userId: user.uid,
        provider: exampleSSOProfileData.provider,
        providerAccountId: exampleSSOProfileData.id,
        providerRefreshToken: 'dscsdc',
        providerAccessToken: null,
        providerScope: 'user.email',
        loggedIn: currentTime,
      });

      const result = await userService.createProviderAccount(
        user,
        'sdcsdcsdc',
        'dscsdc',
        exampleSSOProfileData,
      );
      expect(result).toEqual({
        id: '123dcdc',
        userId: user.uid,
        provider: exampleSSOProfileData.provider,
        providerAccountId: exampleSSOProfileData.id,
        providerRefreshToken: 'dscsdc',
        providerAccessToken: null,
        providerScope: 'user.email',
        loggedIn: currentTime,
      });
    });

    test('should successfully create ProviderAccount for user given no refreshToken', async () => {
      mockPrisma.account.create.mockResolvedValueOnce({
        id: '123dcdc',
        userId: user.uid,
        provider: exampleSSOProfileData.provider,
        providerAccountId: exampleSSOProfileData.id,
        providerRefreshToken: null,
        providerAccessToken: 'sdcsdcsdc',
        providerScope: 'user.email',
        loggedIn: currentTime,
      });

      const result = await userService.createProviderAccount(
        user,
        'sdcsdcsdc',
        'dscsdc',
        exampleSSOProfileData,
      );
      expect(result).toEqual({
        id: '123dcdc',
        userId: user.uid,
        provider: exampleSSOProfileData.provider,
        providerAccountId: exampleSSOProfileData.id,
        providerRefreshToken: null,
        providerAccessToken: 'sdcsdcsdc',
        providerScope: 'user.email',
        loggedIn: currentTime,
      });
    });
  });

  describe('updateUserSessions', () => {
    test('Should resolve right and update users GQL session', async () => {
      const sessionData = user.currentGQLSession;

      mockPrisma.user.update.mockResolvedValue({
        ...user,
        currentGQLSession: sessionData,
        currentRESTSession: null,
      });

      const result = await userService.updateUserSessions(
        user,
        JSON.stringify(sessionData),
        'GQL',
      );

      expect(result).toEqualRight({
        ...user,
        currentGQLSession: JSON.stringify(sessionData),
        currentRESTSession: null,
      });
    });
    test('Should resolve right and update users REST session', async () => {
      const sessionData = user.currentGQLSession;
      mockPrisma.user.update.mockResolvedValue({
        ...user,
        currentGQLSession: null,
        currentRESTSession: sessionData,
      });

      const result = await userService.updateUserSessions(
        user,
        JSON.stringify(sessionData),
        'REST',
      );

      expect(result).toEqualRight({
        ...user,
        currentGQLSession: null,
        currentRESTSession: JSON.stringify(sessionData),
      });
    });
    test('Should reject left and update user for invalid GQL session', async () => {
      const sessionData = 'invalid json';

      const result = await userService.updateUserSessions(
        user,
        sessionData,
        'GQL',
      );

      expect(result).toEqualLeft(JSON_INVALID);
    });
    test('Should reject left and update user for invalid REST session', async () => {
      const sessionData = 'invalid json';

      const result = await userService.updateUserSessions(
        user,
        sessionData,
        'REST',
      );

      expect(result).toEqualLeft(JSON_INVALID);
    });

    test('Should publish pubsub message on user update sessions', async () => {
      mockPrisma.user.update.mockResolvedValue({
        ...user,
      });

      await userService.updateUserSessions(
        user,
        JSON.stringify(user.currentGQLSession),
        'GQL',
      );

      expect(mockPubSub.publish).toHaveBeenCalledTimes(1);
      expect(mockPubSub.publish).toHaveBeenCalledWith(
        `user/${user.uid}/updated`,
        {
          ...user,
          currentGQLSession: JSON.stringify(user.currentGQLSession),
          currentRESTSession: JSON.stringify(user.currentRESTSession),
        },
      );
    });
  });

  describe('updateUserDisplayName', () => {
    test('should resolve right and update user display name', async () => {
      const newDisplayName = 'New Name';
      mockPrisma.user.update.mockResolvedValueOnce({
        ...user,
        displayName: newDisplayName,
      });

      const result = await userService.updateUserDisplayName(
        user.uid,
        newDisplayName,
      );
      expect(result).toEqualRight({
        ...user,
        displayName: newDisplayName,
        currentGQLSession: JSON.stringify(user.currentGQLSession),
        currentRESTSession: JSON.stringify(user.currentRESTSession),
      });
    });
    test('should resolve right and publish user updated subscription', async () => {
      const newDisplayName = 'New Name';
      mockPrisma.user.update.mockResolvedValueOnce({
        ...user,
        displayName: newDisplayName,
      });

      await userService.updateUserDisplayName(user.uid, user.displayName);
      expect(mockPubSub.publish).toHaveBeenCalledWith(
        `user/${user.uid}/updated`,
        {
          ...user,
          displayName: newDisplayName,
          currentGQLSession: JSON.stringify(user.currentGQLSession),
          currentRESTSession: JSON.stringify(user.currentRESTSession),
        },
      );
    });
    test('should resolve left and error when invalid user uid is passed', async () => {
      mockPrisma.user.update.mockRejectedValueOnce('NotFoundError');

      const result = await userService.updateUserDisplayName(
        'invalidUserUid',
        user.displayName,
      );
      expect(result).toEqualLeft(USER_NOT_FOUND);
    });
    test('should resolve left and error when short display name is passed', async () => {
      const newDisplayName = '';
      const result = await userService.updateUserDisplayName(
        user.uid,
        newDisplayName,
      );
      expect(result).toEqualLeft(USER_SHORT_DISPLAY_NAME);
    });
  });

  describe('updateUserLastLoggedOn', () => {
    test('should resolve right and update user last logged on', async () => {
      const currentTime = new Date();
      mockPrisma.user.update.mockResolvedValueOnce({
        ...user,
        lastLoggedOn: currentTime,
      });

      const result = await userService.updateUserLastLoggedOn(user.uid);
      expect(result).toEqualRight(true);
    });

    test('should resolve left and error when invalid user uid is passed', async () => {
      mockPrisma.user.update.mockRejectedValueOnce('NotFoundError');

      const result = await userService.updateUserLastLoggedOn('invalidUserUid');
      expect(result).toEqualLeft(USER_NOT_FOUND);
    });
  });

  describe('fetchAllUsers', () => {
    test('should resolve right and return 20 users when cursor is null', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce(users);

      const result = await userService.fetchAllUsers(null, 20);
      expect(result).toEqual(users);
    });
    test('should resolve right and return next 20 users when cursor is provided', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce(users);

      const result = await userService.fetchAllUsers('123344', 20);
      expect(result).toEqual(users);
    });
    test('should resolve left and return an empty array when users not found', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const result = await userService.fetchAllUsers(null, 20);
      expect(result).toEqual([]);
    });
  });

  describe('fetchAllUsersV2', () => {
    test('should resolve right and return first 20 users when searchString is null', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce(users);

      const result = await userService.fetchAllUsersV2(null, {
        take: 20,
        skip: 0,
      });
      expect(result).toEqual(users);
    });
    test('should resolve right and return next 20 users when searchString is provided', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce(users);

      const result = await userService.fetchAllUsersV2('.com', {
        take: 20,
        skip: 0,
      });
      expect(result).toEqual(users);
    });
    test('should resolve left and return an empty array when users not found', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const result = await userService.fetchAllUsersV2('Unknown entry', {
        take: 20,
        skip: 0,
      });
      expect(result).toEqual([]);
    });
  });

  describe('fetchAdminUsers', () => {
    test('should return a list of admin users', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce(adminUsers);
      const result = await userService.fetchAdminUsers();
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          isAdmin: true,
        },
      });
      expect(result).toEqual(adminUsers);
    });
    test('should return null when no admin users found', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce(null);
      const result = await userService.fetchAdminUsers();
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          isAdmin: true,
        },
      });
      expect(result).toEqual(null);
    });
  });

  describe('makeAdmin', () => {
    test('should resolve right and return a user object after making a user admin', async () => {
      mockPrisma.user.update.mockResolvedValueOnce(adminUser);
      const result = await userService.makeAdmin(user.uid);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: {
          uid: user.uid,
        },
        data: {
          isAdmin: true,
        },
      });
      expect(result).toEqualRight(adminUser);
    });
    test('should resolve left and error when invalid user uid is passed', async () => {
      mockPrisma.user.update.mockRejectedValueOnce('NotFoundError');
      const result = await userService.makeAdmin(user.uid);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: {
          uid: user.uid,
        },
        data: {
          isAdmin: true,
        },
      });
      expect(result).toEqualLeft(USER_NOT_FOUND);
    });
  });

  describe('deleteUserByID', () => {
    test('should resolve right for valid user uid and perform successful user deletion', () => {
      // For a successful deletion, the handlers should allow user deletion
      handler1.canAllowUserDeletion.mockImplementation(() => TO.none);
      handler2.canAllowUserDeletion.mockImplementation(() => TO.none);
      handler1.onUserDelete.mockImplementation(() => T.of(undefined));
      handler2.onUserDelete.mockImplementation(() => T.of(undefined));
      mockPrisma.user.delete.mockResolvedValueOnce(user);

      const result = service.deleteUserByUID(user)();
      return expect(result).resolves.toBeRight();
    });
    test('should resolve right for successful deletion and publish user deleted subscription', async () => {
      // For a successful deletion, the handlers should allow user deletion
      handler1.canAllowUserDeletion.mockImplementation(() => TO.none);
      handler2.canAllowUserDeletion.mockImplementation(() => TO.none);
      handler1.onUserDelete.mockImplementation(() => T.of(undefined));
      handler2.onUserDelete.mockImplementation(() => T.of(undefined));

      mockPrisma.user.delete.mockResolvedValueOnce(user);
      const result = service.deleteUserByUID(user)();
      await expect(result).resolves.toBeRight();

      // fire the subscription for user deletion
      expect(mockPubSub.publish).toHaveBeenCalledWith(
        `user/${user.uid}/deleted`,
        <User>{
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          isAdmin: user.isAdmin,
          currentRESTSession: user.currentRESTSession,
          currentGQLSession: user.currentGQLSession,
          createdOn: user.createdOn,
        },
      );
    });
    test("should resolve left when one or both the handlers don't allow userDeletion", () => {
      // Handlers don't allow user deletion
      handler1.canAllowUserDeletion.mockImplementation(() => TO.some);
      handler2.canAllowUserDeletion.mockImplementation(() => TO.some);

      const result = service.deleteUserByUID(user)();
      return expect(result).resolves.toBeLeft();
    });
    test('should resolve left when ther is an unsuccessful deletion of userdata from firestore', () => {
      // Handlers allow deletion to proceed
      handler1.canAllowUserDeletion.mockImplementation(() => TO.none);
      handler2.canAllowUserDeletion.mockImplementation(() => TO.none);
      handler1.onUserDelete.mockImplementation(() => T.of(undefined));
      handler2.onUserDelete.mockImplementation(() => T.of(undefined));

      // Deleting users errors out
      mockPrisma.user.delete.mockRejectedValueOnce('NotFoundError');

      const result = service.deleteUserByUID(user)();
      return expect(result).resolves.toBeLeft();
    });
  });

  describe('getUsersCount', () => {
    test('should return count of all users in the organization', async () => {
      mockPrisma.user.count.mockResolvedValueOnce(10);

      const result = await userService.getUsersCount();
      expect(result).toEqual(10);
    });
  });

  describe('removeUsersAsAdmin', () => {
    test('should resolve right and return true for valid user UIDs', async () => {
      mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });
      const result = await userService.removeUsersAsAdmin(['123344']);
      expect(result).toEqualRight(true);
    });
    test('should resolve right and return false for invalid user UIDs', async () => {
      mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 0 });
      const result = await userService.removeUsersAsAdmin(['123344']);
      expect(result).toEqualLeft(USERS_NOT_FOUND);
    });
  });
});
