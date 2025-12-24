# SMART on FHIR Sandbox Integration

## Overview
This application is configured to support the **SMART EHR Launch** flow, which allows it to be launched directly from an EHR (or Sandbox) environment.

## Registration Details
When registering this app in a Sandbox (e.g., [Logica Sandbox](https://sandbox.logicahealth.org/) or [SmartHealthIT Launcher](https://launch.smarthealthit.org/)), use the following settings:

- **Launch Type**: Confidential Client (if using `client_secret` or Asymmetric) or Public Client (if configured without secret, though current setup defaults to confidential).
- **App Launch URL**: `https://<YOUR_DOMAIN>/api/auth/smart/launch`
    - *Example (Local)*: `http://localhost:3000/api/auth/smart/launch`
- **Redirect URI**: `https://<YOUR_DOMAIN>/api/auth/smart/callback`
    - *Example (Local)*: `http://localhost:3000/api/auth/smart/callback`
- **Scopes**: `patient/Patient.read patient/Observation.read launch online_access openid profile`

## SMART App Structure Mapping
If your Sandbox requires specific filenames (`launch.html`, `index.html`):

- **launch.html**: We provide a shim at `http://localhost:3000/launch.html` which redirects to our secure backend `http://localhost:3000/api/auth/smart/launch`.
- **index.html**: This corresponds to our main dashboard at `http://localhost:3000/dashboard` (where the user lands after authorization).

## Environment Variables (.env.local)

Make sure your environment variables are set correctly for the auth type you chose in the Sandbox.

### Symmetric (Client Secret)
If the Sandbox gives you a Client Secret:
```env
SMART_AUTH_TYPE=symmetric
SMART_CLIENT_ID=<Client ID from Sandbox>
SMART_CLIENT_SECRET=<Client Secret from Sandbox>
```

### Asymmetric (Private Key JWT)
If you registered a Public Key (JWK) with the Sandbox:
```env
SMART_AUTH_TYPE=asymmetric
SMART_CLIENT_ID=<Client ID from Sandbox>
SMART_KEY_ID=<Key ID (kid)>
SMART_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

## How it Works
1.  **Launch**: The EHR redirects to your **Launch URL** with `iss` (FHIR Server URL) and `launch` (Launch Handle) parameters.
2.  **Redirect**: The app stores these parameters and redirects the user to the EHR's **Authorization Endpoint**.
3.  **Authorize**: The user logs in to the EHR and approves access.
4.  **Callback**: The EHR redirects back to your **Redirect URI** with an `auth_code`.
5.  **Token Exchange**: The app exchanges the code for an Access Token using the configured authentication method.
