import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSamlProfile } from '../src/saml-profile.js';

test('maps University of Arizona SAML OID attributes', function() {
  const normalized = normalizeSamlProfile({
    'urn:oid:0.9.2342.19200300.100.1.3': ['student@example.edu'],
    'urn:oid:1.3.6.1.4.1.5643.10.0.1': ['UA123456'],
    'urn:oid:2.5.4.4': ['Student'],
    'urn:oid:2.5.4.42': ['Sample'],
    'urn:oid:2.16.840.1.113730.3.1.241': ['Sample Student']
  });

  assert.deepEqual(normalized, {
    email: 'student@example.edu',
    oid: 'UA123456',
    name: 'Sample Student'
  });
});

test('maps University of Arizona friendly names', function() {
  const normalized = normalizeSamlProfile({
    mail: 'teacher@example.edu',
    uaId: 'UA654321',
    givenName: 'Friendly',
    surname: 'Teacher'
  });

  assert.deepEqual(normalized, {
    email: 'teacher@example.edu',
    oid: 'UA654321',
    name: 'Friendly Teacher'
  });
});

test('uses displayName before givenName and surname', function() {
  const normalized = normalizeSamlProfile({
    mail: 'display@example.edu',
    uaId: 'UA111111',
    displayName: 'Preferred Display',
    givenName: 'Legal',
    surname: 'Name'
  });

  assert.equal(normalized.name, 'Preferred Display');
});

test('falls back to commonName when display and given surname are missing', function() {
  const normalized = normalizeSamlProfile({
    mail: 'common@example.edu',
    uaId: 'UA222222',
    commonName: 'Common Name'
  });

  assert.deepEqual(normalized, {
    email: 'common@example.edu',
    oid: 'UA222222',
    name: 'Common Name'
  });
});
