import { mockDeep, mockReset } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import {
  INVALID_EMAIL,
  SHORTCODE_INVALID_PROPERTIES_JSON,
  SHORTCODE_INVALID_REQUEST_JSON,
  SHORTCODE_NOT_FOUND,
  SHORTCODE_PROPERTIES_NOT_FOUND,
} from 'src/errors';
import { Shortcode, ShortcodeWithUserEmail } from './shortcode.model';
import { ShortcodeService } from './shortcode.service';
import { UserService } from 'src/user/user.service';
import { AuthUser } from 'src/types/AuthUser';

const mockPrisma = mockDeep<PrismaService>();

const mockPubSub = {
  publish: jest.fn().mockResolvedValue(null),
};

const mockDocFunc = jest.fn();

const mockFB = {
  firestore: {
    doc: mockDocFunc,
  },
};
const mockUserService = new UserService(mockPrisma as any, mockPubSub as any);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const shortcodeService = new ShortcodeService(
  mockPrisma,
  mockPubSub as any,
  mockUserService,
);

beforeEach(() => {
  mockReset(mockPrisma);
  mockPubSub.publish.mockClear();
});
const createdOn = new Date();

const user: AuthUser = {
  uid: '123344',
  email: 'dwight@dundermifflin.com',
  displayName: 'Dwight Schrute',
  photoURL: 'https://en.wikipedia.org/wiki/Dwight_Schrute',
  isAdmin: false,
  refreshToken: 'hbfvdkhjbvkdvdfjvbnkhjb',
  lastLoggedOn: createdOn,
  lastActiveOn: createdOn,
  createdOn: createdOn,
  currentGQLSession: {},
  currentRESTSession: {},
};

const mockEmbed = {
  id: '123',
  request: '{}',
  embedProperties: '{}',
  createdOn: createdOn,
  creatorUid: user.uid,
  updatedOn: createdOn,
};

const mockShortcode = {
  id: '123',
  request: '{}',
  embedProperties: null,
  createdOn: createdOn,
  creatorUid: user.uid,
  updatedOn: createdOn,
};

const shortcodes = [
  {
    id: 'blablabla',
    request: {
      hello: 'there',
    },
    embedProperties: {
      foo: 'bar',
    },
    creatorUid: user.uid,
    createdOn: new Date(),
    updatedOn: createdOn,
  },
  {
    id: 'blablabla1',
    request: {
      hello: 'there',
    },
    embedProperties: {
      foo: 'bar',
    },
    creatorUid: user.uid,
    createdOn: new Date(),
    updatedOn: createdOn,
  },
];

const shortcodesWithUserEmail = [
  {
    id: 'blablabla',
    request: {
      hello: 'there',
    },
    embedProperties: {
      foo: 'bar',
    },
    creatorUid: user.uid,
    createdOn: new Date(),
    updatedOn: createdOn,
    User: user,
  },
  {
    id: 'blablabla1',
    request: {
      hello: 'there',
    },
    embedProperties: {
      foo: 'bar',
    },
    creatorUid: user.uid,
    createdOn: new Date(),
    updatedOn: createdOn,
    User: user,
  },
];

describe('ShortcodeService', () => {
  describe('getShortCode', () => {
    test('should return a valid Shortcode with valid Shortcode ID', async () => {
      mockPrisma.shortcode.findFirstOrThrow.mockResolvedValueOnce(mockEmbed);

      const result = await shortcodeService.getShortCode(mockEmbed.id);
      expect(result).toEqualRight(<Shortcode>{
        id: mockEmbed.id,
        createdOn: mockEmbed.createdOn,
        request: JSON.stringify(mockEmbed.request),
        properties: JSON.stringify(mockEmbed.embedProperties),
      });
    });

    test('should throw SHORTCODE_NOT_FOUND error when shortcode ID is invalid', async () => {
      mockPrisma.shortcode.findFirstOrThrow.mockRejectedValueOnce(
        'NotFoundError',
      );

      const result = await shortcodeService.getShortCode('invalidID');
      expect(result).toEqualLeft(SHORTCODE_NOT_FOUND);
    });
  });

  describe('fetchUserShortCodes', () => {
    test('should return list of Shortcode with valid inputs and no cursor', async () => {
      mockPrisma.shortcode.findMany.mockResolvedValueOnce(shortcodes);

      const result = await shortcodeService.fetchUserShortCodes(user.uid, {
        cursor: null,
        take: 10,
      });
      expect(result).toEqual(<Shortcode[]>[
        {
          id: shortcodes[0].id,
          request: JSON.stringify(shortcodes[0].request),
          properties: JSON.stringify(shortcodes[0].embedProperties),
          createdOn: shortcodes[0].createdOn,
        },
        {
          id: shortcodes[1].id,
          request: JSON.stringify(shortcodes[1].request),
          properties: JSON.stringify(shortcodes[1].embedProperties),
          createdOn: shortcodes[1].createdOn,
        },
      ]);
    });

    test('should return list of Shortcode with valid inputs and cursor', async () => {
      mockPrisma.shortcode.findMany.mockResolvedValue([shortcodes[1]]);

      const result = await shortcodeService.fetchUserShortCodes(user.uid, {
        cursor: 'blablabla',
        take: 10,
      });
      expect(result).toEqual(<Shortcode[]>[
        {
          id: shortcodes[1].id,
          request: JSON.stringify(shortcodes[1].request),
          properties: JSON.stringify(shortcodes[1].embedProperties),
          createdOn: shortcodes[1].createdOn,
        },
      ]);
    });

    test('should return an empty array for an invalid cursor', async () => {
      mockPrisma.shortcode.findMany.mockResolvedValue([]);

      const result = await shortcodeService.fetchUserShortCodes(user.uid, {
        cursor: 'invalidcursor',
        take: 10,
      });

      expect(result).toHaveLength(0);
    });

    test('should return an empty array for an invalid user id and null cursor', async () => {
      mockPrisma.shortcode.findMany.mockResolvedValue([]);

      const result = await shortcodeService.fetchUserShortCodes('invalidid', {
        cursor: null,
        take: 10,
      });

      expect(result).toHaveLength(0);
    });

    test('should return an empty array for an invalid user id and an invalid cursor', async () => {
      mockPrisma.shortcode.findMany.mockResolvedValue([]);

      const result = await shortcodeService.fetchUserShortCodes('invalidid', {
        cursor: 'invalidcursor',
        take: 10,
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('createShortcode', () => {
    test('should throw SHORTCODE_INVALID_REQUEST_JSON error if incoming request data is invalid', async () => {
      const result = await shortcodeService.createShortcode(
        'invalidRequest',
        null,
        user,
      );
      expect(result).toEqualLeft(SHORTCODE_INVALID_REQUEST_JSON);
    });

    test('should throw SHORTCODE_INVALID_PROPERTIES_JSON error if incoming properties data is invalid', async () => {
      const result = await shortcodeService.createShortcode(
        '{}',
        'invalid_data',
        user,
      );
      expect(result).toEqualLeft(SHORTCODE_INVALID_PROPERTIES_JSON);
    });

    test('should successfully create a new Embed with valid user uid', async () => {
      // generateUniqueShortCodeID --> getShortcode
      mockPrisma.shortcode.findFirstOrThrow.mockRejectedValueOnce(
        'NotFoundError',
      );
      mockPrisma.shortcode.create.mockResolvedValueOnce(mockEmbed);

      const result = await shortcodeService.createShortcode('{}', '{}', user);
      expect(result).toEqualRight(<Shortcode>{
        id: mockEmbed.id,
        createdOn: mockEmbed.createdOn,
        request: JSON.stringify(mockEmbed.request),
        properties: JSON.stringify(mockEmbed.embedProperties),
      });
    });

    test('should successfully create a new ShortCode with valid user uid', async () => {
      // generateUniqueShortCodeID --> getShortcode
      mockPrisma.shortcode.findFirstOrThrow.mockRejectedValueOnce(
        'NotFoundError',
      );
      mockPrisma.shortcode.create.mockResolvedValueOnce(mockShortcode);

      const result = await shortcodeService.createShortcode('{}', null, user);
      expect(result).toEqualRight(<Shortcode>{
        id: mockShortcode.id,
        createdOn: mockShortcode.createdOn,
        request: JSON.stringify(mockShortcode.request),
        properties: mockShortcode.embedProperties,
      });
    });

    test('should send pubsub message to `shortcode/{uid}/created` on successful creation of a Shortcode', async () => {
      // generateUniqueShortCodeID --> getShortcode
      mockPrisma.shortcode.findFirstOrThrow.mockRejectedValueOnce(
        'NotFoundError',
      );
      mockPrisma.shortcode.create.mockResolvedValueOnce(mockShortcode);

      const result = await shortcodeService.createShortcode('{}', null, user);

      expect(mockPubSub.publish).toHaveBeenCalledWith(
        `shortcode/${mockShortcode.creatorUid}/created`,
        <Shortcode>{
          id: mockShortcode.id,
          createdOn: mockShortcode.createdOn,
          request: JSON.stringify(mockShortcode.request),
          properties: mockShortcode.embedProperties,
        },
      );
    });

    test('should send pubsub message to `shortcode/{uid}/created` on successful creation of an Embed', async () => {
      // generateUniqueShortCodeID --> getShortcode
      mockPrisma.shortcode.findFirstOrThrow.mockRejectedValueOnce(
        'NotFoundError',
      );
      mockPrisma.shortcode.create.mockResolvedValueOnce(mockEmbed);

      const result = await shortcodeService.createShortcode('{}', '{}', user);

      expect(mockPubSub.publish).toHaveBeenCalledWith(
        `shortcode/${mockEmbed.creatorUid}/created`,
        <Shortcode>{
          id: mockEmbed.id,
          createdOn: mockEmbed.createdOn,
          request: JSON.stringify(mockEmbed.request),
          properties: JSON.stringify(mockEmbed.embedProperties),
        },
      );
    });
  });

  describe('revokeShortCode', () => {
    test('should return true on successful deletion of Shortcode with valid inputs', async () => {
      mockPrisma.shortcode.delete.mockResolvedValueOnce(mockEmbed);

      const result = await shortcodeService.revokeShortCode(
        mockEmbed.id,
        mockEmbed.creatorUid,
      );

      expect(mockPrisma.shortcode.delete).toHaveBeenCalledWith({
        where: {
          creator_uid_shortcode_unique: {
            creatorUid: mockEmbed.creatorUid,
            id: mockEmbed.id,
          },
        },
      });

      expect(result).toEqualRight(true);
    });

    test('should return SHORTCODE_NOT_FOUND error when Shortcode is invalid and user uid is valid', async () => {
      mockPrisma.shortcode.delete.mockRejectedValue('RecordNotFound');
      expect(
        shortcodeService.revokeShortCode('invalid', 'testuser'),
      ).resolves.toEqualLeft(SHORTCODE_NOT_FOUND);
    });

    test('should return SHORTCODE_NOT_FOUND error when Shortcode is valid and user uid is invalid', async () => {
      mockPrisma.shortcode.delete.mockRejectedValue('RecordNotFound');
      expect(
        shortcodeService.revokeShortCode('blablablabla', 'invalidUser'),
      ).resolves.toEqualLeft(SHORTCODE_NOT_FOUND);
    });

    test('should return SHORTCODE_NOT_FOUND error when both Shortcode and user uid are invalid', async () => {
      mockPrisma.shortcode.delete.mockRejectedValue('RecordNotFound');
      expect(
        shortcodeService.revokeShortCode('invalid', 'invalid'),
      ).resolves.toEqualLeft(SHORTCODE_NOT_FOUND);
    });

    test('should send pubsub message to `shortcode/{uid}/revoked` on successful deletion of Shortcode', async () => {
      mockPrisma.shortcode.delete.mockResolvedValueOnce(mockEmbed);

      const result = await shortcodeService.revokeShortCode(
        mockEmbed.id,
        mockEmbed.creatorUid,
      );

      expect(mockPubSub.publish).toHaveBeenCalledWith(
        `shortcode/${mockEmbed.creatorUid}/revoked`,
        {
          id: mockEmbed.id,
          createdOn: mockEmbed.createdOn,
          request: JSON.stringify(mockEmbed.request),
          properties: JSON.stringify(mockEmbed.embedProperties),
        },
      );
    });
  });

  describe('deleteUserShortCodes', () => {
    test('should successfully delete all users Shortcodes with valid user uid', async () => {
      mockPrisma.shortcode.deleteMany.mockResolvedValueOnce({ count: 1 });

      const result = await shortcodeService.deleteUserShortCodes(
        mockEmbed.creatorUid,
      );
      expect(result).toEqual(1);
    });

    test('should return 0 when user uid is invalid', async () => {
      mockPrisma.shortcode.deleteMany.mockResolvedValueOnce({ count: 0 });

      const result = await shortcodeService.deleteUserShortCodes(
        mockEmbed.creatorUid,
      );
      expect(result).toEqual(0);
    });
  });

  describe('updateShortcode', () => {
    test('should return SHORTCODE_PROPERTIES_NOT_FOUND error when updatedProps in invalid', async () => {
      const result = await shortcodeService.updateEmbedProperties(
        mockEmbed.id,
        user.uid,
        '',
      );
      expect(result).toEqualLeft(SHORTCODE_PROPERTIES_NOT_FOUND);
    });

    test('should return SHORTCODE_PROPERTIES_NOT_FOUND error when updatedProps in invalid JSON format', async () => {
      const result = await shortcodeService.updateEmbedProperties(
        mockEmbed.id,
        user.uid,
        '{kk',
      );
      expect(result).toEqualLeft(SHORTCODE_INVALID_PROPERTIES_JSON);
    });

    test('should return SHORTCODE_NOT_FOUND error when Shortcode ID is invalid', async () => {
      mockPrisma.shortcode.update.mockRejectedValue('RecordNotFound');
      const result = await shortcodeService.updateEmbedProperties(
        'invalidID',
        user.uid,
        '{}',
      );
      expect(result).toEqualLeft(SHORTCODE_NOT_FOUND);
    });

    test('should successfully update a Shortcodes with valid inputs', async () => {
      mockPrisma.shortcode.update.mockResolvedValueOnce({
        ...mockEmbed,
        embedProperties: '{"foo":"bar"}',
      });

      const result = await shortcodeService.updateEmbedProperties(
        mockEmbed.id,
        user.uid,
        '{"foo":"bar"}',
      );
      expect(result).toEqualRight({
        id: mockEmbed.id,
        createdOn: mockEmbed.createdOn,
        request: JSON.stringify(mockEmbed.request),
        properties: JSON.stringify('{"foo":"bar"}'),
      });
    });

    test('should send pubsub message to `shortcode/{uid}/updated` on successful Update of Shortcode', async () => {
      mockPrisma.shortcode.update.mockResolvedValueOnce({
        ...mockEmbed,
        embedProperties: '{"foo":"bar"}',
      });

      const result = await shortcodeService.updateEmbedProperties(
        mockEmbed.id,
        user.uid,
        '{"foo":"bar"}',
      );

      expect(mockPubSub.publish).toHaveBeenCalledWith(
        `shortcode/${mockEmbed.creatorUid}/updated`,
        {
          id: mockEmbed.id,
          createdOn: mockEmbed.createdOn,
          request: JSON.stringify(mockEmbed.request),
          properties: JSON.stringify('{"foo":"bar"}'),
        },
      );
    });
  });

  describe('deleteShortcode', () => {
    test('should return true on successful deletion of Shortcode with valid inputs', async () => {
      mockPrisma.shortcode.delete.mockResolvedValueOnce(mockEmbed);

      const result = await shortcodeService.deleteShortcode(mockEmbed.id);
      expect(result).toEqualRight(true);
    });

    test('should return SHORTCODE_NOT_FOUND error when Shortcode is invalid', async () => {
      mockPrisma.shortcode.delete.mockRejectedValue('RecordNotFound');

      expect(shortcodeService.deleteShortcode('invalid')).resolves.toEqualLeft(
        SHORTCODE_NOT_FOUND,
      );
    });
  });

  describe('fetchAllShortcodes', () => {
    test('should return list of Shortcodes with valid inputs and no cursor', async () => {
      mockPrisma.shortcode.findMany.mockResolvedValueOnce(
        shortcodesWithUserEmail,
      );

      const result = await shortcodeService.fetchAllShortcodes(
        {
          cursor: null,
          take: 10,
        },
        user.email,
      );
      expect(result).toEqual(<ShortcodeWithUserEmail[]>[
        {
          id: shortcodesWithUserEmail[0].id,
          request: JSON.stringify(shortcodesWithUserEmail[0].request),
          properties: JSON.stringify(
            shortcodesWithUserEmail[0].embedProperties,
          ),
          createdOn: shortcodesWithUserEmail[0].createdOn,
          creator: {
            uid: user.uid,
            email: user.email,
          },
        },
        {
          id: shortcodesWithUserEmail[1].id,
          request: JSON.stringify(shortcodesWithUserEmail[1].request),
          properties: JSON.stringify(
            shortcodesWithUserEmail[1].embedProperties,
          ),
          createdOn: shortcodesWithUserEmail[1].createdOn,
          creator: {
            uid: user.uid,
            email: user.email,
          },
        },
      ]);
    });

    test('should return list of Shortcode with valid inputs and cursor', async () => {
      mockPrisma.shortcode.findMany.mockResolvedValue([
        shortcodesWithUserEmail[1],
      ]);

      const result = await shortcodeService.fetchAllShortcodes(
        {
          cursor: 'blablabla',
          take: 10,
        },
        user.email,
      );
      expect(result).toEqual(<ShortcodeWithUserEmail[]>[
        {
          id: shortcodesWithUserEmail[1].id,
          request: JSON.stringify(shortcodesWithUserEmail[1].request),
          properties: JSON.stringify(
            shortcodesWithUserEmail[1].embedProperties,
          ),
          createdOn: shortcodesWithUserEmail[1].createdOn,
          creator: {
            uid: user.uid,
            email: user.email,
          },
        },
      ]);
    });

    test('should return an empty array for an invalid cursor', async () => {
      mockPrisma.shortcode.findMany.mockResolvedValue([]);

      const result = await shortcodeService.fetchAllShortcodes(
        {
          cursor: 'invalidcursor',
          take: 10,
        },
        user.email,
      );

      expect(result).toHaveLength(0);
    });
  });
});
