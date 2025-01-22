import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Account, VerificationToken } from '@prisma/client';
import { mockDeep, mockFn } from 'jest-mock-extended';
import {
  INVALID_EMAIL,
  INVALID_MAGIC_LINK_DATA,
  INVALID_REFRESH_TOKEN,
  MAGIC_LINK_EXPIRED,
  VERIFICATION_TOKEN_DATA_NOT_FOUND,
  USER_NOT_FOUND,
} from 'src/errors';
import { MailerService } from 'src/mailer/mailer.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthUser } from 'src/types/AuthUser';
import { UserService } from 'src/user/user.service';
import { AuthService } from './auth.service';
import * as O from 'fp-ts/Option';
import { VerifyMagicDto } from './dto/verify-magic.dto';
import * as E from 'fp-ts/Either';
import { ConfigService } from '@nestjs/config';
import { InfraConfigService } from 'src/infra-config/infra-config.service';

const mockPrisma = mockDeep<PrismaService>();
const mockUser = mockDeep<UserService>();
const mockJWT = mockDeep<JwtService>();
const mockMailer = mockDeep<MailerService>();
const mockConfigService = mockDeep<ConfigService>();
const mockInfraConfigService = mockDeep<InfraConfigService>();

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const authService = new AuthService(
  mockUser,
  mockPrisma,
  mockJWT,
  mockMailer,
  mockConfigService,
  mockInfraConfigService,
);

const currentTime = new Date();

const user: AuthUser = {
  uid: '123344',
  email: 'dwight@dundermifflin.com',
  displayName: 'Dwight Schrute',
  photoURL: 'https://en.wikipedia.org/wiki/Dwight_Schrute',
  isAdmin: false,
  refreshToken: 'hbfvdkhjbvkdvdfjvbnkhjb',
  lastLoggedOn: currentTime,
  lastActiveOn: currentTime,
  createdOn: currentTime,
  currentGQLSession: {},
  currentRESTSession: {},
};

const passwordlessData: VerificationToken = {
  deviceIdentifier: 'k23hb7u7gdcujhb',
  token: 'jhhj24sdjvl',
  userUid: user.uid,
  expiresOn: new Date(),
};

const magicLinkVerify: VerifyMagicDto = {
  deviceIdentifier: 'Dscdc',
  token: 'SDcsdc',
};

const accountDetails: Account = {
  id: '123dcdc',
  userId: user.uid,
  provider: 'email',
  providerAccountId: user.uid,
  providerRefreshToken: 'dscsdc',
  providerAccessToken: 'sdcsdcsdc',
  providerScope: 'user.email',
  loggedIn: currentTime,
};

let nowPlus30 = new Date();
nowPlus30.setMinutes(nowPlus30.getMinutes() + 30000);
nowPlus30 = new Date(nowPlus30);

const encodedRefreshToken =
  '$argon2id$v=19$m=65536,t=3,p=4$JTP8yZ8YXMHdafb5pB9Rfg$tdZrILUxMb9dQbu0uuyeReLgKxsgYnyUNbc5ZxQmy5I';

describe('signInMagicLink', () => {
  test('Should throw error if email is not in valid format', async () => {
    const result = await authService.signInMagicLink('bbbgmail.com', 'admin');
    expect(result).toEqualLeft({
      message: INVALID_EMAIL,
      statusCode: HttpStatus.BAD_REQUEST,
    });
  });

  test('Should successfully create a new user account and return the passwordless details', async () => {
    // check to see if user exists, return none
    mockUser.findUserByEmail.mockResolvedValue(O.none);
    // create new user
    mockUser.createUserViaMagicLink.mockResolvedValue(user);
    // create new entry in VerificationToken table
    mockPrisma.verificationToken.create.mockResolvedValueOnce(passwordlessData);
    // Read env variable 'MAGIC_LINK_TOKEN_VALIDITY' from config service
    mockConfigService.get.mockReturnValue('3');

    const result = await authService.signInMagicLink(
      'dwight@dundermifflin.com',
      'admin',
    );
    expect(result).toEqualRight({
      deviceIdentifier: passwordlessData.deviceIdentifier,
    });
  });

  test('Should successfully return the passwordless details for a pre-existing user account', async () => {
    // check to see if user exists, return error
    mockUser.findUserByEmail.mockResolvedValueOnce(O.some(user));
    // create new entry in VerificationToken table
    mockPrisma.verificationToken.create.mockResolvedValueOnce(passwordlessData);

    const result = await authService.signInMagicLink(
      'dwight@dundermifflin.com',
      'admin',
    );
    expect(result).toEqualRight({
      deviceIdentifier: passwordlessData.deviceIdentifier,
    });
  });
});

describe('verifyMagicLinkTokens', () => {
  test('Should throw INVALID_MAGIC_LINK_DATA if data is invalid', async () => {
    mockPrisma.verificationToken.findUniqueOrThrow.mockRejectedValueOnce(
      'NotFoundError',
    );

    const result = await authService.verifyMagicLinkTokens(magicLinkVerify);
    expect(result).toEqualLeft({
      message: INVALID_MAGIC_LINK_DATA,
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  test('Should throw USER_NOT_FOUND if user is invalid', async () => {
    // validatePasswordlessTokens
    mockPrisma.verificationToken.findUniqueOrThrow.mockResolvedValueOnce(
      passwordlessData,
    );
    // findUserById
    mockUser.findUserById.mockResolvedValue(O.none);

    const result = await authService.verifyMagicLinkTokens(magicLinkVerify);
    expect(result).toEqualLeft({
      message: USER_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  test('Should successfully return auth token pair with provider account existing', async () => {
    // validatePasswordlessTokens
    mockPrisma.verificationToken.findUniqueOrThrow.mockResolvedValueOnce({
      ...passwordlessData,
      expiresOn: nowPlus30,
    });
    // findUserById
    mockUser.findUserById.mockResolvedValue(O.some(user));
    // checkIfProviderAccountExists
    mockPrisma.account.findUnique.mockResolvedValueOnce(accountDetails);
    // mockPrisma.account.findUnique.mockResolvedValueOnce(null);
    // generateAuthTokens
    mockJWT.sign.mockReturnValue(user.refreshToken);
    // UpdateUserRefreshToken
    mockUser.updateUserRefreshToken.mockResolvedValueOnce(E.right(user));
    // deletePasswordlessVerificationToken
    mockPrisma.verificationToken.delete.mockResolvedValueOnce(passwordlessData);
    // usersService.updateUserLastLoggedOn
    mockUser.updateUserLastLoggedOn.mockResolvedValue(E.right(true));

    const result = await authService.verifyMagicLinkTokens(magicLinkVerify);
    expect(result).toEqualRight({
      access_token: user.refreshToken,
      refresh_token: user.refreshToken,
    });
  });

  test('Should successfully return auth token pair with provider account not existing', async () => {
    // validatePasswordlessTokens
    mockPrisma.verificationToken.findUniqueOrThrow.mockResolvedValueOnce({
      ...passwordlessData,
      expiresOn: nowPlus30,
    });
    // findUserById
    mockUser.findUserById.mockResolvedValue(O.some(user));
    // checkIfProviderAccountExists
    mockPrisma.account.findUnique.mockResolvedValueOnce(null);
    mockUser.createUserSSO.mockResolvedValueOnce(user);
    // generateAuthTokens
    mockJWT.sign.mockReturnValue(user.refreshToken);
    // UpdateUserRefreshToken
    mockUser.updateUserRefreshToken.mockResolvedValueOnce(E.right(user));
    // deletePasswordlessVerificationToken
    mockPrisma.verificationToken.delete.mockResolvedValueOnce(passwordlessData);
    // usersService.updateUserLastLoggedOn
    mockUser.updateUserLastLoggedOn.mockResolvedValue(E.right(true));

    const result = await authService.verifyMagicLinkTokens(magicLinkVerify);
    expect(result).toEqualRight({
      access_token: user.refreshToken,
      refresh_token: user.refreshToken,
    });
  });

  test('Should throw MAGIC_LINK_EXPIRED if passwordless token is expired', async () => {
    // validatePasswordlessTokens
    mockPrisma.verificationToken.findUniqueOrThrow.mockResolvedValueOnce(
      passwordlessData,
    );
    // findUserById
    mockUser.findUserById.mockResolvedValue(O.some(user));
    // checkIfProviderAccountExists
    mockPrisma.account.findUnique.mockResolvedValueOnce(accountDetails);

    const result = await authService.verifyMagicLinkTokens(magicLinkVerify);
    expect(result).toEqualLeft({
      message: MAGIC_LINK_EXPIRED,
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  });

  test('Should throw USER_NOT_FOUND when updating refresh tokens fails', async () => {
    // validatePasswordlessTokens
    mockPrisma.verificationToken.findUniqueOrThrow.mockResolvedValueOnce({
      ...passwordlessData,
      expiresOn: nowPlus30,
    });
    // findUserById
    mockUser.findUserById.mockResolvedValue(O.some(user));
    // checkIfProviderAccountExists
    mockPrisma.account.findUnique.mockResolvedValueOnce(accountDetails);
    // mockPrisma.account.findUnique.mockResolvedValueOnce(null);
    // generateAuthTokens
    mockJWT.sign.mockReturnValue(user.refreshToken);
    // UpdateUserRefreshToken
    mockUser.updateUserRefreshToken.mockResolvedValueOnce(
      E.left(USER_NOT_FOUND),
    );

    const result = await authService.verifyMagicLinkTokens(magicLinkVerify);
    expect(result).toEqualLeft({
      message: USER_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  test('Should throw PASSWORDLESS_DATA_NOT_FOUND when deleting passwordlessVerification entry from DB', async () => {
    // validatePasswordlessTokens
    mockPrisma.verificationToken.findUniqueOrThrow.mockResolvedValueOnce({
      ...passwordlessData,
      expiresOn: nowPlus30,
    });
    // findUserById
    mockUser.findUserById.mockResolvedValue(O.some(user));
    // checkIfProviderAccountExists
    mockPrisma.account.findUnique.mockResolvedValueOnce(accountDetails);
    // mockPrisma.account.findUnique.mockResolvedValueOnce(null);
    // generateAuthTokens
    mockJWT.sign.mockReturnValue(user.refreshToken);
    // UpdateUserRefreshToken
    mockUser.updateUserRefreshToken.mockResolvedValueOnce(E.right(user));
    // deletePasswordlessVerificationToken
    mockPrisma.verificationToken.delete.mockRejectedValueOnce('RecordNotFound');

    const result = await authService.verifyMagicLinkTokens(magicLinkVerify);
    expect(result).toEqualLeft({
      message: VERIFICATION_TOKEN_DATA_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
    });
  });
});

describe('generateAuthTokens', () => {
  test('Should successfully generate tokens with valid inputs', async () => {
    mockJWT.sign.mockReturnValue(user.refreshToken);
    // UpdateUserRefreshToken
    mockUser.updateUserRefreshToken.mockResolvedValueOnce(E.right(user));

    const result = await authService.generateAuthTokens(user.uid);
    expect(result).toEqualRight({
      access_token: 'hbfvdkhjbvkdvdfjvbnkhjb',
      refresh_token: 'hbfvdkhjbvkdvdfjvbnkhjb',
    });
  });

  test('Should throw USER_NOT_FOUND when updating refresh tokens fails', async () => {
    mockJWT.sign.mockReturnValue(user.refreshToken);
    // UpdateUserRefreshToken
    mockUser.updateUserRefreshToken.mockResolvedValueOnce(
      E.left(USER_NOT_FOUND),
    );

    const result = await authService.generateAuthTokens(user.uid);
    expect(result).toEqualLeft({
      message: USER_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
    });
  });
});

jest.mock('argon2', () => {
  return {
    verify: jest.fn((x, y) => {
      if (y === null) return false;
      return true;
    }),
    hash: jest.fn(),
  };
});

describe('refreshAuthTokens', () => {
  test('Should throw USER_NOT_FOUND when updating refresh tokens fails', async () => {
    // generateAuthTokens
    mockJWT.sign.mockReturnValue(user.refreshToken);
    // UpdateUserRefreshToken
    mockUser.updateUserRefreshToken.mockResolvedValueOnce(
      E.left(USER_NOT_FOUND),
    );

    const result = await authService.refreshAuthTokens(
      '$argon2id$v=19$m=65536,t=3,p=4$MvVOam2clCOLtJFGEE26ZA$czvA5ez9hz+A/LML8QRgqgaFuWa5JcbwkH6r+imTQbs',
      user,
    );
    expect(result).toEqualLeft({
      message: USER_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  test('Should throw USER_NOT_FOUND when user is invalid', async () => {
    const result = await authService.refreshAuthTokens(
      'jshdcbjsdhcbshdbc',
      null,
    );
    expect(result).toEqualLeft({
      message: USER_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  test('Should successfully refresh the tokens and generate a new auth token pair', async () => {
    // generateAuthTokens
    mockJWT.sign.mockReturnValue('sdhjcbjsdhcbshjdcb');
    // UpdateUserRefreshToken
    mockUser.updateUserRefreshToken.mockResolvedValueOnce(
      E.right({
        ...user,
        refreshToken: 'sdhjcbjsdhcbshjdcb',
      }),
    );

    const result = await authService.refreshAuthTokens(
      '$argon2id$v=19$m=65536,t=3,p=4$MvVOam2clCOLtJFGEE26ZA$czvA5ez9hz+A/LML8QRgqgaFuWa5JcbwkH6r+imTQbs',
      user,
    );
    expect(result).toEqualRight({
      access_token: 'sdhjcbjsdhcbshjdcb',
      refresh_token: 'sdhjcbjsdhcbshjdcb',
    });
  });

  test('Should throw INVALID_REFRESH_TOKEN when the refresh token is invalid', async () => {
    // generateAuthTokens
    mockJWT.sign.mockReturnValue('sdhjcbjsdhcbshjdcb');
    mockPrisma.user.update.mockResolvedValueOnce({
      ...user,
      refreshToken: 'sdhjcbjsdhcbshjdcb',
    });

    const result = await authService.refreshAuthTokens(null, user);
    expect(result).toEqualLeft({
      message: INVALID_REFRESH_TOKEN,
      statusCode: HttpStatus.NOT_FOUND,
    });
  });
});

describe('verifyAdmin', () => {
  test('should successfully elevate user to admin when userCount is 1 ', async () => {
    // getUsersCount
    mockUser.getUsersCount.mockResolvedValueOnce(1);
    // makeAdmin
    mockUser.makeAdmin.mockResolvedValueOnce(
      E.right({
        ...user,
        isAdmin: true,
      }),
    );

    const result = await authService.verifyAdmin(user);
    expect(result).toEqualRight({ isAdmin: true });
  });

  test('should return true if user is already an admin', async () => {
    const result = await authService.verifyAdmin({ ...user, isAdmin: true });
    expect(result).toEqualRight({ isAdmin: true });
  });

  test('should throw USERS_NOT_FOUND when userUid is invalid', async () => {
    // getUsersCount
    mockUser.getUsersCount.mockResolvedValueOnce(1);
    // makeAdmin
    mockUser.makeAdmin.mockResolvedValueOnce(E.left(USER_NOT_FOUND));

    const result = await authService.verifyAdmin(user);
    expect(result).toEqualLeft({
      message: USER_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  test('should return false when user is not an admin and userCount is greater than 1', async () => {
    // getUsersCount
    mockUser.getUsersCount.mockResolvedValueOnce(13);

    const result = await authService.verifyAdmin(user);
    expect(result).toEqualRight({ isAdmin: false });
  });
});
