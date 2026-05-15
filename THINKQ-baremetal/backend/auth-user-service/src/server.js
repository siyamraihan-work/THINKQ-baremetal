import express from 'express';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import passport from 'passport';
import { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import crypto from 'crypto';
import { z } from 'zod';
import {
  PORT,
  REDIS_URL,
  SAML_ENTRY_POINT,
  SAML_IDP_ENTITY_ID,
  SAML_ISSUER,
  SAML_CALLBACK_URL,
  SAML_CERT,
  COOKIE_SECURE,
  FRONTEND_BASE_URL,
  LOGIN_PATH,
  UNAUTHORIZED_PATH,
  POST_LOGIN_PATH,
  DEV_AUTH_ENABLED,
  SERVICE_HOST
} from './settings.js';

import { dataRequest } from './http.js';
import { requireSession } from './session-middleware.js';

const app = express();
const redis = new Redis(REDIS_URL);
const devAuthEnabled = String(DEV_AUTH_ENABLED).toLowerCase() === 'true';

app.use(express.json());
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(passport.initialize());

if (!devAuthEnabled) {
  const samlStrategy = new SamlStrategy(
    {
      entryPoint: SAML_ENTRY_POINT,
      issuer: SAML_ISSUER,
      idpIssuer: SAML_IDP_ENTITY_ID,
      audience: SAML_ISSUER,
      callbackUrl: SAML_CALLBACK_URL,
      cert: SAML_CERT,
      identifierFormat: null,
      wantAssertionsSigned: true,
      validateInResponseTo: 'always',
      requestIdExpirationPeriodMs: 5 * 60 * 1000,
      acceptedClockSkewMs: 2 * 60 * 1000,
      disableRequestedAuthnContext: true
    },
    function(profile, done) {
      return done(null, profile);
    }
  );
  passport.use(samlStrategy);
}

function buildSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    maxAge: 1000 * 60 * 60 * 8,
    path: '/'
  };
}

function firstValue(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0 && value[0]) {
      return String(value[0]).trim();
    }
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/$/, '');
}

function buildFrontendUrl(path) {
  const base = normalizeBaseUrl(FRONTEND_BASE_URL);
  const rawPath = String(path || '/');
  const normalizedPath = rawPath.startsWith('/') ? rawPath : '/' + rawPath;
  return base + normalizedPath;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildServiceProviderMetadata() {
  const entityId = escapeXml(SAML_ISSUER);
  const callbackUrl = escapeXml(SAML_CALLBACK_URL);

  return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${callbackUrl}" index="1" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

function normalizeSamlProfile(profile) {
  const email = firstValue(
    profile && profile.mail,
    profile && profile.email,
    profile && profile.emailAddress,
    profile && profile.eduPersonPrincipalName,
    profile && profile.eppn,
    profile && profile['urn:oid:0.9.2342.19200300.100.1.3'],
    profile && profile['urn:oid:1.3.6.1.4.1.5923.1.1.1.6'],
    profile && profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
    profile && profile.nameID
  );

  const oid = firstValue(
    profile && profile.oid,
    profile && profile.uid,
    profile && profile.eduPersonTargetedID,
    profile && profile.persistentId,
    profile && profile.eduPersonPrincipalName,
    profile && profile.eppn,
    profile && profile.employeeNumber,
    profile && profile['urn:oid:1.3.6.1.4.1.5643.10.0.1'],
    profile && profile['urn:oid:1.3.6.1.4.1.5923.1.1.1.10'],
    profile && profile['urn:oid:1.3.6.1.4.1.5923.1.1.1.6'],
    profile && profile['http://schemas.microsoft.com/identity/claims/objectidentifier'],
    profile && profile['urn:oid:0.9.2342.19200300.100.1.1'],
    profile && profile.nameID
  );

  const firstName = firstValue(
    profile && profile.firstName,
    profile && profile.givenName,
    profile && profile.given_name,
    profile && profile['urn:oid:2.5.4.42']
  );

  const lastName = firstValue(
    profile && profile.lastName,
    profile && profile.sn,
    profile && profile.surname,
    profile && profile.family_name,
    profile && profile['urn:oid:2.5.4.4']
  );

  const displayName = firstValue(
    profile && profile.displayName,
    profile && profile.cn,
    profile && profile.name,
    profile && profile['urn:oid:2.5.4.3'],
    profile && profile['urn:oid:2.16.840.1.113730.3.1.241']
  );

  const combinedName = [firstName, lastName].filter(Boolean).join(' ');
  const name = firstValue(displayName, combinedName, email);

  return { email, oid, name };
}

async function createOrRefreshSession(user) {
  const sid = crypto.randomUUID();
  const session = {
    sid: sid,
    user: user,
    createdAt: new Date().toISOString()
  };

  await redis.set(
    'session:' + sid,
    JSON.stringify(session),
    'EX',
    60 * 60 * 8
  );

  await dataRequest('/internal/sessions', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: sid,
      userId: user.id,
      loggedIn: true
    })
  });

  return sid;
}

app.get('/health', function(req, res) {
  res.json({ status: 'ok', service: 'auth-user-service' });
});

if (!devAuthEnabled) {
  app.get('/auth/login', passport.authenticate('saml'));

  app.get('/auth/metadata', function(req, res) {
    res.type('application/samlmetadata+xml').send(buildServiceProviderMetadata());
  });

  app.get('/auth/metadata-mapping', function(req, res) {
    res.json({
      idp: {
        entityId: SAML_IDP_ENTITY_ID,
        redirectSsoUrl: SAML_ENTRY_POINT,
        postSsoUrl: 'https://shibboleth.arizona.edu/idp/profile/SAML2/POST/SSO'
      },
      serviceProvider: {
        entityId: SAML_ISSUER,
        assertionConsumerService: SAML_CALLBACK_URL,
        metadataUrl: buildFrontendUrl('/auth/metadata')
      },
      expectedMappings: {
        email: [
          'mail',
          'eduPersonPrincipalName',
          'urn:oid:0.9.2342.19200300.100.1.3',
          'urn:oid:1.3.6.1.4.1.5923.1.1.1.6',
          'NameID'
        ],
        oid: [
          'uid',
          'eduPersonTargetedID',
          'eduPersonPrincipalName',
          'urn:oid:1.3.6.1.4.1.5923.1.1.1.10',
          'urn:oid:1.3.6.1.4.1.5923.1.1.1.6',
          'urn:oid:0.9.2342.19200300.100.1.1',
          'NameID'
        ],
        name: [
          'urn:oid:2.5.4.3',
          'urn:oid:2.16.840.1.113730.3.1.241',
          'urn:oid:2.5.4.42 + urn:oid:2.5.4.4'
        ]
      }
    });
  });

  app.post(
    '/auth/saml/callback',
    passport.authenticate('saml', {
      session: false,
      failureRedirect: buildFrontendUrl(UNAUTHORIZED_PATH)
    }),
    async function(req, res, next) {
      try {
        const normalized = normalizeSamlProfile(req.user || {});

        if (!normalized.email || !normalized.oid || !normalized.name) {
          return res.redirect(buildFrontendUrl(UNAUTHORIZED_PATH));
        }

        const user = await dataRequest('/internal/users/upsert-from-saml', {
          method: 'POST',
          body: JSON.stringify(normalized)
        });

        const sid = await createOrRefreshSession(user);

        res.cookie('sid', sid, buildSessionCookieOptions());
        res.redirect(buildFrontendUrl(POST_LOGIN_PATH));
      } catch (error) {
        next(error);
      }
    }
  );
} else {
  app.get('/auth/login', function(req, res) {
    res.status(404).json({ error: 'SAML login is disabled in development mode' });
  });

  app.get('/auth/metadata', function(req, res) {
    res.status(404).json({ error: 'SAML metadata is disabled in development mode' });
  });

  app.get('/auth/metadata-mapping', function(req, res) {
    res.status(404).json({ error: 'SAML metadata mapping is disabled in development mode' });
  });

  app.post('/auth/saml/callback', function(req, res) {
    res.status(404).json({ error: 'SAML callback is disabled in development mode' });
  });
}

app.get('/users/me', requireSession(redis), async function(req, res, next) {
  try {
    const user = await dataRequest('/internal/users/' + req.user.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

app.get('/auth/ping', requireSession(redis), function(req, res) {
  res.json({ ok: true, userId: req.user.id, role: req.user.role });
});

app.post('/auth/logout', requireSession(redis), async function(req, res, next) {
  try {
    const sid = req.cookies.sid;
    await redis.del('session:' + sid);
    await dataRequest('/internal/sessions/' + sid, { method: 'DELETE' });
    res.clearCookie('sid', { path: '/' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get('/auth/redirect-if-missing', async function(req, res) {
  const sid = req.cookies.sid;
  if (!sid) {
    return res.redirect(buildFrontendUrl(LOGIN_PATH));
  }

  const raw = await redis.get('session:' + sid);
  if (!raw) {
    return res.redirect(buildFrontendUrl(LOGIN_PATH));
  }

  res.json({ ok: true });
});

app.post('/auth/dev-login', async function(req, res, next) {
  try {
    if (!devAuthEnabled) {
      return res.status(404).json({ error: 'Not found' });
    }

    const schema = z.object({
      email: z.string().email(),
      oid: z.string().min(3),
      name: z.string().min(1),
      role: z.enum(['ADMIN', 'TEACHER', 'STUDENT'])
    });

    const parsed = schema.parse(req.body);

    const user = await dataRequest('/internal/users/upsert-from-saml', {
      method: 'POST',
      body: JSON.stringify({
        email: parsed.email,
        oid: parsed.oid,
        name: parsed.name
      })
    });

    const updatedUser = await dataRequest('/internal/users/' + user.id + '/role', {
      method: 'PATCH',
      body: JSON.stringify({
        role: parsed.role
      })
    });

    const sid = await createOrRefreshSession(updatedUser);

    res.cookie('sid', sid, buildSessionCookieOptions());
    res.json({
      message: 'Development login created',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
});

app.use(function(error, req, res, next) {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
});

app.listen(PORT, SERVICE_HOST, function() {
  console.log('auth-user-service listening on ' + SERVICE_HOST + ':' + PORT);
});
