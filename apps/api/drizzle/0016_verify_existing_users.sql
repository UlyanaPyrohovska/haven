-- Email verification became mandatory; accounts created before it stay able to sign in.
UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false;
