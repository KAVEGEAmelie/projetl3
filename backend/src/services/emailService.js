const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Configuration du transporteur email
 */
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

/**
 * Templates d'emails
 */
const emailTemplates = {
  // Template de vérification d'email
  verification: (firstName, verificationUrl) => ({
    subject: 'Vérifiez votre compte AfrikMode 🌍',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FFF9F6;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #8B2E2E; font-size: 28px; margin: 0;">AfrikMode</h1>
          <p style="color: #6B8E23; font-size: 16px; margin: 5px 0;">Mode Africaine Authentique</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #8B2E2E; margin-bottom: 20px;">Bonjour ${firstName} ! 👋</h2>
          
          <p style="color: #3A3A3A; line-height: 1.6; margin-bottom: 20px;">
            Bienvenue sur AfrikMode ! Nous sommes ravis de vous accueillir dans notre communauté passionnée de mode africaine.
          </p>
          
          <p style="color: #3A3A3A; line-height: 1.6; margin-bottom: 30px;">
            Pour finaliser votre inscription et découvrir nos magnifiques collections, veuillez cliquer sur le bouton ci-dessous :
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: linear-gradient(135deg, #8B2E2E 0%, #D9744F 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-weight: bold; 
                      display: inline-block;
                      box-shadow: 0 4px 15px rgba(139, 46, 46, 0.3);">
              ✨ Vérifier mon compte
            </a>
          </div>
          
          <p style="color: #6B6B6B; font-size: 14px; line-height: 1.6;">
            Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
            <a href="${verificationUrl}" style="color: #8B2E2E; word-break: break-all;">${verificationUrl}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #F5E4D7; margin: 30px 0;">
          
          <p style="color: #6B6B6B; font-size: 12px; line-height: 1.4;">
            Ce lien de vérification expirera dans 24 heures. Si vous n'avez pas créé de compte sur AfrikMode, ignorez simplement cet email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B6B6B; font-size: 12px;">
          <p>© 2024 AfrikMode - Célébrer la beauté africaine</p>
          <p>🌍 Lomé, Togo | 📧 contact@afrikmode.com</p>
        </div>
      </div>
    `,
    text: `
      Bonjour ${firstName},
      
      Bienvenue sur AfrikMode !
      
      Pour vérifier votre compte, cliquez sur ce lien : ${verificationUrl}
      
      Ce lien expirera dans 24 heures.
      
      L'équipe AfrikMode
    `
  }),

  // Template de réinitialisation de mot de passe
  passwordReset: (firstName, resetUrl) => ({
    subject: 'Réinitialisez votre mot de passe AfrikMode 🔐',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FFF9F6;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #8B2E2E; font-size: 28px; margin: 0;">AfrikMode</h1>
          <p style="color: #6B8E23; font-size: 16px; margin: 5px 0;">Mode Africaine Authentique</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #8B2E2E; margin-bottom: 20px;">Bonjour ${firstName},</h2>
          
          <p style="color: #3A3A3A; line-height: 1.6; margin-bottom: 20px;">
            Vous avez demandé la réinitialisation de votre mot de passe sur AfrikMode.
          </p>
          
          <p style="color: #3A3A3A; line-height: 1.6; margin-bottom: 30px;">
            Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: linear-gradient(135deg, #8B2E2E 0%, #D9744F 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-weight: bold; 
                      display: inline-block;
                      box-shadow: 0 4px 15px rgba(139, 46, 46, 0.3);">
              🔐 Réinitialiser mon mot de passe
            </a>
          </div>
          
          <p style="color: #6B6B6B; font-size: 14px; line-height: 1.6;">
            Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
            <a href="${resetUrl}" style="color: #8B2E2E; word-break: break-all;">${resetUrl}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #F5E4D7; margin: 30px 0;">
          
          <p style="color: #D9744F; font-size: 14px; font-weight: bold;">
            ⚠️ Important : Ce lien expirera dans 1 heure pour votre sécurité.
          </p>
          
          <p style="color: #6B6B6B; font-size: 12px; line-height: 1.4;">
            Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe restera inchangé.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B6B6B; font-size: 12px;">
          <p>© 2024 AfrikMode - Votre sécurité est notre priorité</p>
        </div>
      </div>
    `,
    text: `
      Bonjour ${firstName},
      
      Vous avez demandé la réinitialisation de votre mot de passe.
      
      Cliquez sur ce lien pour créer un nouveau mot de passe : ${resetUrl}
      
      Ce lien expirera dans 1 heure.
      
      L'équipe AfrikMode
    `
  }),

  // Template de confirmation de commande
  orderConfirmation: (firstName, orderNumber, orderTotal, orderItems) => ({
    subject: `Commande confirmée #${orderNumber} - AfrikMode 🛍️`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FFF9F6;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #8B2E2E; font-size: 28px; margin: 0;">AfrikMode</h1>
          <p style="color: #6B8E23; font-size: 16px; margin: 5px 0;">Votre commande est confirmée !</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #8B2E2E; margin-bottom: 20px;">Merci ${firstName} ! 🎉</h2>
          
          <p style="color: #3A3A3A; line-height: 1.6; margin-bottom: 20px;">
            Votre commande <strong>#${orderNumber}</strong> a été confirmée et sera traitée sous peu.
          </p>
          
          <div style="background: #F5E4D7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #8B2E2E; margin-top: 0;">Récapitulatif de votre commande</h3>
            ${orderItems.map(item => `
              <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #E0E0E0;">
                <span>${item.name} x${item.quantity}</span>
                <span style="font-weight: bold;">${item.price} FCFA</span>
              </div>
            `).join('')}
            <div style="display: flex; justify-content: space-between; margin-top: 20px; padding-top: 15px; border-top: 2px solid #8B2E2E; font-size: 18px; font-weight: bold; color: #8B2E2E;">
              <span>Total</span>
              <span>${orderTotal} FCFA</span>
            </div>
          </div>
          
          <p style="color: #3A3A3A; line-height: 1.6; margin-bottom: 30px;">
            Nous vous enverrons une notification dès que votre commande sera expédiée avec les informations de suivi.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B6B6B; font-size: 12px;">
          <p>© 2024 AfrikMode - Merci de votre confiance</p>
        </div>
      </div>
    `,
    text: `
      Bonjour ${firstName},
      
      Votre commande #${orderNumber} a été confirmée !
      Total : ${orderTotal} FCFA
      
      Nous vous tiendrons informé(e) du suivi de votre commande.
      
      L'équipe AfrikMode
    `
  }),

  // Template de newsletter
  newsletter: (firstName, subject, content) => ({
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FFF9F6;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #8B2E2E; font-size: 28px; margin: 0;">AfrikMode</h1>
          <p style="color: #6B8E23; font-size: 16px; margin: 5px 0;">Newsletter</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #8B2E2E; margin-bottom: 20px;">Bonjour ${firstName} ! 👋</h2>
          ${content}
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6B6B6B; font-size: 12px;">
          <p>© 2024 AfrikMode</p>
          <p><a href="#" style="color: #8B2E2E;">Se désabonner</a></p>
        </div>
      </div>
    `,
    text: `Bonjour ${firstName},\n\n${content}\n\nL'équipe AfrikMode`
  })
};

/**
 * Envoyer un email de vérification
 */
const sendVerificationEmail = async (email, token, firstName) => {
  try {
    const transporter = createTransporter();
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/verify-email?token=${token}`;
    const template = emailTemplates.verification(firstName, verificationUrl);
    
    await transporter.sendMail({
      from: `${process.env.MAIL_FROM_NAME || 'AfrikMode'} <${process.env.MAIL_FROM}>`,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
    
    console.log(`✅ Email de vérification envoyé à ${email}`);
    return true;
    
  } catch (error) {
    console.error('❌ Erreur envoi email de vérification:', error);
    throw error;
  }
};

/**
 * Envoyer un email de réinitialisation de mot de passe
 */
const sendPasswordResetEmail = async (email, token, firstName) => {
  try {
    const transporter = createTransporter();
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/reset-password?token=${token}`;
    const template = emailTemplates.passwordReset(firstName, resetUrl);
    
    await transporter.sendMail({
      from: `${process.env.MAIL_FROM_NAME || 'AfrikMode'} <${process.env.MAIL_FROM}>`,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
    
    console.log(`✅ Email de réinitialisation envoyé à ${email}`);
    return true;
    
  } catch (error) {
    console.error('❌ Erreur envoi email de réinitialisation:', error);
    throw error;
  }
};

/**
 * Envoyer un email de confirmation de commande
 */
const sendOrderConfirmationEmail = async (email, firstName, orderData) => {
  try {
    const transporter = createTransporter();
    const template = emailTemplates.orderConfirmation(
      firstName,
      orderData.orderNumber,
      orderData.total,
      orderData.items
    );
    
    await transporter.sendMail({
      from: `${process.env.MAIL_FROM_NAME || 'AfrikMode'} <${process.env.MAIL_FROM}>`,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
    
    console.log(`✅ Email de confirmation de commande envoyé à ${email}`);
    return true;
    
  } catch (error) {
    console.error('❌ Erreur envoi email de confirmation:', error);
    throw error;
  }
};

/**
 * Envoyer une newsletter
 */
const sendNewsletterEmail = async (email, firstName, subject, content) => {
  try {
    const transporter = createTransporter();
    const template = emailTemplates.newsletter(firstName, subject, content);
    
    await transporter.sendMail({
      from: `${process.env.MAIL_FROM_NAME || 'AfrikMode'} <${process.env.MAIL_FROM}>`,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
    
    console.log(`✅ Newsletter envoyée à ${email}`);
    return true;
    
  } catch (error) {
    console.error('❌ Erreur envoi newsletter:', error);
    throw error;
  }
};

/**
 * Tester la connexion email
 */
const testConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Connexion email configurée correctement');
    return true;
  } catch (error) {
    console.error('❌ Erreur configuration email:', error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendNewsletterEmail,
  testConnection
};