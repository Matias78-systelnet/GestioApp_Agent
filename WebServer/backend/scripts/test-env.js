Object.assign(process.env, {
  LDAP_URL: 'ldaps://localhost:636', LDAP_BIND_DN: 'CN=test,DC=example,DC=com',
  LDAP_BIND_PASSWORD: 'test-only', API_TOKEN: 'test-token-with-more-than-thirty-two-characters',
  LDAP_BASE_DN: 'DC=example,DC=com', LDAP_USERS_OU: 'OU=Users,DC=example,DC=com',
  LDAP_CA_CERT_PATH: '', HTTPS_CERT_PATH: '', HTTPS_KEY_PATH: '',
  AUTH_GROUP_ADMIN_DN: '', AUTH_GROUP_SUPERVISOR_DN: '', AUTH_GROUP_USER_DN: '',
  AGENT_DEVICE_TOKENS: '{}', ENROLLMENT_DATABASE_URL: ''
});
