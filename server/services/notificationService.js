import nodemailer from 'nodemailer';

export async function sendEmailOtp(email, otpCode, purpose = 'Sign-In Verification') {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'RoboPath 3D <no-reply@robopath.edu>';

  if (host && user && pass) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: `RoboPath 3D — ${purpose} Code: ${otpCode}`,
      text: `Your RoboPath 3D one-time verification code is: ${otpCode}\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fdfaf0; border: 1px solid #e2d9c0; border-radius: 12px; color: #0f1e36;">
          <h2 style="margin-top: 0; color: #0d4f56;">RoboPath 3D Verification</h2>
          <p>Use the following one-time verification code for <strong>${purpose}</strong>:</p>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 16px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center; color: #0f766e;">
            ${otpCode}
          </div>
          <p style="font-size: 12px; color: #64748b; margin-top: 16px;">This code expires in 5 minutes and can only be used once.</p>
        </div>
      `,
    });

    return {
      delivered: true,
      provider: 'smtp',
    };
  }

  if (process.env.NODE_ENV === 'production') {
    const err = new Error(
      'SMTP email provider is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.'
    );
    err.status = 503;
    throw err;
  }

  console.log(
    `[RoboPath DEV-ONLY EMAIL OTP] To: ${email} | Purpose: ${purpose} | Code: ${otpCode}`
  );
  return {
    delivered: false,
    provider: 'development-sandbox',
    devCode: otpCode,
    notice:
      'Development Mode: SMTP credentials are not configured in .env. Displaying development-only verification code.',
  };
}

export async function sendSmsOtp(phoneE164, otpCode) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (accountSid && authToken && (fromPhone || verifyServiceSid)) {
    const twilioPkg = await import('twilio');
    const client = twilioPkg.default(accountSid, authToken);

    if (verifyServiceSid) {
      await client.verify.v2
        .services(verifyServiceSid)
        .verifications.create({ to: phoneE164, channel: 'sms' });
      return {
        delivered: true,
        provider: 'twilio-verify',
      };
    }

    await client.messages.create({
      body: `RoboPath 3D verification code: ${otpCode}. Valid for 5 minutes.`,
      from: fromPhone,
      to: phoneE164,
    });

    return {
      delivered: true,
      provider: 'twilio-sms',
    };
  }

  if (process.env.NODE_ENV === 'production') {
    const err = new Error(
      'SMS provider is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.'
    );
    err.status = 503;
    throw err;
  }

  console.log(`[RoboPath DEV-ONLY SMS OTP] To: ${phoneE164} | Code: ${otpCode}`);
  return {
    delivered: false,
    provider: 'development-sandbox',
    devCode: otpCode,
    notice:
      'Development Mode: Twilio SMS credentials are not configured in .env. Displaying development-only SMS code.',
  };
}

export async function verifySmsOtp(phoneE164, code) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !verifyServiceSid) {
    const err = new Error(
      'Twilio Verify is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.'
    );
    err.status = 503;
    throw err;
  }

  const twilioPkg = await import('twilio');
  const client = twilioPkg.default(accountSid, authToken);
  const result = await client.verify.v2
    .services(verifyServiceSid)
    .verificationChecks.create({ to: phoneE164, code });

  return result.status === 'approved';
}
