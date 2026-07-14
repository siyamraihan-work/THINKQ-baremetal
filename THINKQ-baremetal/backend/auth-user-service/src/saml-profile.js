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

export function normalizeSamlProfile(profile) {
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
    profile && profile.uaId,
    profile && profile['urn:oid:1.3.6.1.4.1.5643.10.0.1'],
    profile && profile.uid,
    profile && profile['urn:oid:1.3.6.1.4.1.5923.1.1.1.10'],
    profile && profile.eduPersonTargetedID,
    profile && profile.persistentId,
    profile && profile.eduPersonPrincipalName,
    profile && profile.eppn,
    profile && profile['urn:oid:1.3.6.1.4.1.5923.1.1.1.6'],
    profile && profile.employeeNumber,
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
    profile && profile['urn:oid:2.16.840.1.113730.3.1.241']
  );

  const commonName = firstValue(
    profile && profile.commonName,
    profile && profile.cn,
    profile && profile.name,
    profile && profile['urn:oid:2.5.4.3']
  );

  const combinedName = [firstName, lastName].filter(Boolean).join(' ');
  const name = firstValue(displayName, combinedName, commonName, email);

  return { email, oid, name };
}
