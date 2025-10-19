// emailService.js
import nodemailer from 'nodemailer';
import pool from './db.js';
import { getSettings } from './db.js';
import fs from 'fs';
import path from 'path';

let transporter;
try {
  const config = {
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  // Optional: Enable debug logging (add DEBUG_SMTP=true to .env)
  if (process.env.DEBUG_SMTP === 'true') {
    config.logger = true;
    config.debug = true;
  }

  transporter = nodemailer.createTransport(config);

  // Optional non-blocking verify (logs issues but doesn't throw)
  transporter.verify((error, success) => {
    if (error) {
      console.error('SMTP configuration verification failed:', {
        message: error.message,
        code: error.code,
        response: error.response,
        command: error.command,
        stack: error.stack,
      });
      console.warn('Email sending may not work until fixed. Check 2FA/app password in Google Account.');
      console.warn('Test: https://myaccount.google.com/apppasswords');
    } else {
      console.log('SMTP server is ready to send emails');
    }
  });
} catch (error) {
  console.error('Failed to initialize Nodemailer transporter:', error);
}

// Load logo as base64 (updated path: directly in backend root folder)
const logoPath = path.join(process.cwd(), 'vobiss-logo.png');
let logoBase64;
try {
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = logoBuffer.toString('base64');
    console.log('Logo loaded successfully from', logoPath, '- Base64 size:', logoBase64.length);
  } else {
    console.warn('Logo file not found at', logoPath, '- emails will render without logo. Ensure vobiss-logo.png is in the backend root folder.');
    logoBase64 = null;
  }
} catch (error) {
  console.error('Error loading logo:', error);
  logoBase64 = null;
}

// Send user credentials email
export async function sendUserCredentials(email, username, password) {
  try {
    if (!transporter) {
      throw new Error('Email transporter not initialized');
    }

    const settings = await getSettings();
    const fromName = settings ? settings.from_name : 'Inventory System';
    const fromEmail = settings ? settings.from_email : process.env.SMTP_USER || 'helloriceug@gmail.com';

    // Improved logo centering with fallback
    const logoImg = logoBase64 
      ? `<div style="text-align: center; margin-bottom: 10px;"><img src="data:image/png;base64,${logoBase64}" alt="Vobiss Logo" style="height: 40px; width: auto; max-width: 100%; display: block; margin: 0 auto; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>`
      : '<div style="text-align: center; margin-bottom: 10px;"><p style="font-size: 18px; font-weight: bold; color: #fff; margin: 0;">Vobiss Inventory</p></div>';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: 'Welcome to Vobiss Inventory System - Your Account Details',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              background-color: white; 
              margin: 0; 
              padding: 0; 
              line-height: 1.6;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
              background-color: white; 
            }
            .header { 
              background: linear-gradient(135deg, #2E7D32, #4CAF50); /* Green gradient for inventory theme */
              color: white; 
              padding: 30px 20px; 
              text-align: center; 
              border-radius: 12px 12px 0 0; 
              box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
            }
            .header h1 { 
              margin: 0 0 10px 0; 
              font-size: 28px; 
              font-weight: 300;
            }
            .content { 
              background: white; 
              padding: 30px; 
              border-radius: 0 0 12px 12px; 
              box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
            }
            .credentials { 
              background: #f0f9ff; 
              padding: 20px; 
              border-radius: 8px; 
              margin: 20px 0; 
              border-left: 4px solid #0ea5e9; 
            }
            .credentials p { 
              margin: 10px 0; 
              font-size: 16px; 
            }
            .credentials strong { 
              color: #0c4a6e; 
            }
            .footer { 
              text-align: center; 
              font-size: 14px; 
              color: #666; 
              margin-top: 30px; 
              padding-top: 20px; 
              border-top: 1px solid #eee; 
              background: #f9f9f9; 
              padding: 20px; 
              border-radius: 0 0 12px 12px;
            }
            @media (max-width: 600px) {
              .container { padding: 10px; }
              .header, .content { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${logoImg}
              <h1>Welcome to Vobiss Inventory!</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Your Account Has Been Created</p>
            </div>
            <div class="content">
              <p>Dear User,</p>
              <p>Your account has been successfully created by your administrator.</p>
              <div class="credentials">
                <p><strong>Username:</strong> ${username}</p>
                <p><strong>Temporary Password:</strong> ${password}</p>
                <p><em>Please log in and change your password immediately for security.</em></p>
              </div>
              <p>If you have any questions or did not request this account, please contact your administrator.</p>
            </div>
            <div class="footer">
              <p>Best regards,<br><strong>Vobiss Inventory Management System</strong></p>
              <p>Vobiss Team</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('User credentials email sent successfully:', info.messageId);
  } catch (error) {
    console.error('Error sending user credentials email:', error);
    throw new Error(`Failed to send welcome email: ${error.message}`);
  }
}

// Send password reset email
export async function sendResetPassword(email, username, password) {
  try {
    if (!transporter) {
      throw new Error('Email transporter not initialized');
    }

    const settings = await getSettings();
    const fromName = settings ? settings.from_name : 'Inventory System';
    const fromEmail = settings ? settings.from_email : process.env.SMTP_USER || 'helloriceug@gmail.com';

    // Improved logo centering with fallback
    const logoImg = logoBase64 
      ? `<div style="text-align: center; margin-bottom: 10px;"><img src="data:image/png;base64,${logoBase64}" alt="Vobiss Logo" style="height: 40px; width: auto; max-width: 100%; display: block; margin: 0 auto; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>`
      : '<div style="text-align: center; margin-bottom: 10px;"><p style="font-size: 18px; font-weight: bold; color: #fff; margin: 0;">Vobiss Inventory</p></div>';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: 'Vobiss Inventory System - Password Reset Confirmation',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              background-color: white; 
              margin: 0; 
              padding: 0; 
              line-height: 1.6;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
              background-color: white; 
            }
            .header { 
              background: linear-gradient(135deg, #dc2626, #ef4444); /* Red gradient for reset alert */
              color: white; 
              padding: 30px 20px; 
              text-align: center; 
              border-radius: 12px 12px 0 0; 
              box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
            }
            .header h1 { 
              margin: 0 0 10px 0; 
              font-size: 28px; 
              font-weight: 300;
            }
            .content { 
              background: white; 
              padding: 30px; 
              border-radius: 0 0 12px 12px; 
              box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
            }
            .credentials { 
              background: #fef2f2; 
              padding: 20px; 
              border-radius: 8px; 
              margin: 20px 0; 
              border-left: 4px solid #dc2626; 
            }
            .credentials p { 
              margin: 10px 0; 
              font-size: 16px; 
            }
            .credentials strong { 
              color: #991b1b; 
            }
            .footer { 
              text-align: center; 
              font-size: 14px; 
              color: #666; 
              margin-top: 30px; 
              padding-top: 20px; 
              border-top: 1px solid #eee; 
              background: #f9f9f9; 
              padding: 20px; 
              border-radius: 0 0 12px 12px;
            }
            @media (max-width: 600px) {
              .container { padding: 10px; }
              .header, .content { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${logoImg}
              <h1>Password Reset Confirmation</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Vobiss Inventory Management System</p>
            </div>
            <div class="content">
              <p>Dear User,</p>
              <p>Your password has been reset by an administrator.</p>
              <div class="credentials">
                <p><strong>Username:</strong> ${username}</p>
                <p><strong>New Temporary Password:</strong> ${password}</p>
                <p><em>Please log in and change your password immediately for security.</em></p>
              </div>
              <p>If you did not request this reset, please contact your administrator immediately.</p>
            </div>
            <div class="footer">
              <p>Best regards,<br><strong>Vobiss Inventory Management System</strong></p>
              <p>Vobiss Team</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully:', info.messageId);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error(`Failed to send reset email: ${error.message}`);
  }
}

// Sends summary of ALL low stock items
// Wrapped in try-catch to prevent main operations from failing
export async function sendLowStockAlert(triggeredItem = null) {
  console.log('=== Starting low stock alert check ===');
  try {
    if (!transporter) {
      console.warn('Transporter not initialized, skipping email alert');
      return;
    }

    const settings = await getSettings();
    console.log('Settings fetched:', settings);
    const fromName = settings ? settings.from_name : 'Inventory System';
    const fromEmail = settings ? settings.from_email : process.env.SMTP_USER || 'helloriceug@gmail.com';
    console.log('Email from:', `"${fromName}" <${fromEmail}>`);

    const supervisorsResult = await pool.query('SELECT * FROM supervisors ORDER BY name ASC');
    const supervisors = supervisorsResult.rows;
    console.log('Supervisors found:', supervisors.length, supervisors.map(s => s.email));
    if (supervisors.length === 0) {
      console.warn('No supervisors configured for low stock alerts');
      return;
    }

    // Fetch ALL low stock items (with category join only, no vendor)
    const lowStockResult = await pool.query(`
      SELECT 
        i.id, i.name, i.quantity, i.low_stock_threshold, 
        c.name as category_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.quantity <= COALESCE(i.low_stock_threshold, 5)
      ORDER BY i.quantity ASC, i.name
    `);
    const lowStockItems = lowStockResult.rows;
    console.log('Low stock items found:', lowStockItems.length, lowStockItems.map(i => ({name: i.name, qty: i.quantity})));

    if (lowStockItems.length === 0) {
      console.log('No low stock items to alert about');
      return;
    }

    // Separate critical (qty <= 0) and low (qty > 0 but <= threshold)
    const criticalItems = lowStockItems.filter(item => item.quantity <= 0);
    const lowItems = lowStockItems.filter(item => item.quantity > 0);
    console.log('Critical items:', criticalItems.length, 'Low items:', lowItems.length);

    // Get formatted send date/time
    const now = new Date();
    const dayName = now.toLocaleDateString('en-GB', { weekday: 'long' });
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const sendDateTime = `${dayName} ${dateStr} at ${timeStr}`;

    for (const supervisor of supervisors) {
      let subject = 'Low Stock Alert Summary';
      let alertTypeHeader = 'Low Stock Alert';
      let introText = 'The following items have reached low stock levels. Please review and restock as needed.';

      if (criticalItems.length > 0) {
        subject = `Critical Stock Alert: ${criticalItems.length} Item(s) Out of Stock!`;
        alertTypeHeader = 'Critical Stock Alert';
        introText = `${criticalItems.length} item(s) are out of stock, and ${lowItems.length} more are low. Immediate action required!`;
      }

      console.log(`Preparing email for ${supervisor.email} - Subject: ${subject}`);

      // Build HTML table for items (without Vendor column)
      const buildItemTable = (items, headerColor, rowColor, headerText) => {
        if (items.length === 0) return '';
        return `
          <div style="margin-bottom: 20px;">
            <h3 style="color: ${headerColor}; margin: 0 0 10px 0; border-bottom: 2px solid ${headerColor}; padding-bottom: 5px;">${headerText} (${items.length})</h3>
            <table style="width: 100%; border-collapse: collapse; background: ${rowColor}; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <thead>
                <tr style="background: linear-gradient(135deg, ${headerColor}, ${headerColor}cc);">
                  <th style="padding: 15px; text-align: left; border: none; color: white; font-weight: bold;">Item Name</th>
                  <th style="padding: 15px; text-align: center; border: none; color: white; font-weight: bold;">Quantity</th>
                  <th style="padding: 15px; text-align: center; border: none; color: white; font-weight: bold;">Threshold</th>
                  <th style="padding: 15px; text-align: left; border: none; color: white; font-weight: bold;">Category</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 15px; font-weight: 500; border: none;">${item.name}</td>
                    <td style="padding: 15px; text-align: center; color: ${headerColor}; font-size: 18px; font-weight: bold; border: none;">${item.quantity}</td>
                    <td style="padding: 15px; text-align: center; border: none;">${item.low_stock_threshold || 5}</td>
                    <td style="padding: 15px; border: none;">${item.category_name || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      };

      const criticalTable = buildItemTable(criticalItems, '#d32f2f', '#ffebee', 'Out of Stock');
      const lowTable = buildItemTable(lowItems, '#ff9800', '#fff3e0', 'Low Stock');

      // Improved logo centering with fallback
      const logoImg = logoBase64 
        ? `<div style="text-align: center; margin-bottom: 10px;"><img src="data:image/png;base64,${logoBase64}" alt="Vobiss Logo" style="height: 40px; width: auto; max-width: 100%; display: block; margin: 0 auto; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>`
        : '<div style="text-align: center; margin-bottom: 10px;"><p style="font-size: 18px; font-weight: bold; color: #fff; margin: 0;">Vobiss Inventory</p></div>';

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: supervisor.email,
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                background-color: white; 
                margin: 0; 
                padding: 0; 
                line-height: 1.6;
              }
              .container { 
                max-width: 700px; 
                margin: 0 auto; 
                padding: 20px; 
                background-color: white; 
              }
              .header { 
                background: linear-gradient(135deg, #2E7D32, #4CAF50); /* Green gradient for inventory theme */
                color: white; 
                padding: 30px 20px; 
                text-align: center; 
                border-radius: 12px 12px 0 0; 
                box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
              }
              .header h1 { 
                margin: 0 0 10px 0; 
                font-size: 28px; 
                font-weight: 300;
              }
              .content { 
                background: white; 
                padding: 30px; 
                border-radius: 0 0 12px 12px; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
              }
              .intro { 
                font-size: 16px; 
                margin-bottom: 20px; 
                line-height: 1.6; 
                color: #333; 
              }
              table { 
                box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
                border-radius: 8px; 
                overflow: hidden; 
              }
              th { 
                background: #f8f9fa !important; 
                color: #333 !important; 
                font-weight: 600;
              }
              tr:nth-child(even) { 
                background: #f8f9fa; 
              }
              .footer { 
                text-align: center; 
                font-size: 14px; 
                color: #666; 
                margin-top: 30px; 
                padding-top: 20px; 
                border-top: 1px solid #eee; 
                background: #f9f9f9; 
                padding: 20px; 
                border-radius: 0 0 12px 12px;
              }
              .highlight { 
                animation: pulse 2s infinite; 
              }
              @keyframes pulse { 
                0% { opacity: 1; } 
                50% { opacity: 0.7; } 
                100% { opacity: 1; } 
              }
              @media (max-width: 600px) {
                .container { padding: 10px; }
                .header, .content { padding: 20px; }
                table { font-size: 14px; }
                th, td { padding: 10px; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${logoImg}
                <h1>${alertTypeHeader}</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Vobiss Inventory Management System</p>
              </div>
              <div class="content">
                <p class="intro">Dear <strong>${supervisor.name}</strong>,</p>
                <p class="intro">${introText}</p>
                ${criticalTable}
                ${lowTable}
                <p class="intro" style="font-style: italic; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">This is an automated summary. For real-time updates, check the dashboard.</p>
              </div>
              <div class="footer">
                <p>Sent on: <strong>${sendDateTime}</strong></p>
                <p>Best regards,<br><strong>Inventory Management System</strong><br>Vobiss Inventory</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      // Use sendMail with error handling
      await transporter.sendMail(mailOptions);
      console.log(`Low stock summary alert sent successfully to ${supervisor.email} (${lowStockItems.length} items)`);
    }
    console.log('=== Low stock alert process completed ===');
  } catch (error) {
    console.error('Error in sendLowStockAlert:', {
      message: error.message,
      code: error.code,
      response: error.response,
      command: error.command,
      stack: error.stack,
    });
    // Do not re-throw; log only to prevent main ops from failing
  }
}