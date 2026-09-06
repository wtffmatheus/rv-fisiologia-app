// RV App - fonte de verdade versionada para os e-mails hospedados do Supabase Auth.
// Nao coloque tokens, senhas SMTP ou qualquer outro segredo neste arquivo.

export const projectRef = 'ilnlnkcxajkarwviynbm'

const APP_URL = '{{ .SiteURL }}'
const TEAL = '#20d6cf'
const BG = '#020b16'
const CARD = '#07192d'
const TEXT = '#f4f8fb'
const MUTED = '#9ab0c4'
const LINE = '#17334c'

function emailShell({
  eyebrow = 'RV FISIOLOGIA',
  title,
  body,
  ctaLabel,
  ctaUrl,
  code,
  footer = 'Esta mensagem foi enviada automaticamente pelo RV App.',
}) {
  const cta = ctaLabel && ctaUrl
    ? `
      <tr>
        <td style="padding:8px 0 22px 0">
          <a href="${ctaUrl}" style="display:inline-block;background:${TEAL};color:#032027;text-decoration:none;font-size:14px;font-weight:800;line-height:20px;padding:13px 20px;border-radius:10px">${ctaLabel}</a>
        </td>
      </tr>`
    : ''

  const codeBlock = code
    ? `
      <tr>
        <td style="padding:4px 0 22px 0">
          <div style="border:1px solid ${LINE};border-radius:12px;background:#041326;padding:18px;text-align:center;color:${TEXT};font-size:28px;line-height:34px;font-weight:800;letter-spacing:6px">${code}</div>
        </td>
      </tr>`
    : ''

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BG};padding:28px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;border:1px solid ${LINE};border-radius:18px;background:${CARD}">
            <tr>
              <td style="padding:30px 30px 8px 30px;color:${TEAL};font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.6px">${eyebrow}</td>
            </tr>
            <tr>
              <td style="padding:0 30px 12px 30px;color:${TEXT};font-size:28px;line-height:34px;font-weight:800;letter-spacing:-0.6px">${title}</td>
            </tr>
            <tr>
              <td style="padding:0 30px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:0 0 20px 0;color:${MUTED};font-size:14px;line-height:22px">${body}</td>
                  </tr>
                  ${codeBlock}
                  ${cta}
                </table>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid ${LINE};padding:18px 30px 24px 30px;color:#6f879f;font-size:11px;line-height:17px">
                ${footer}<br>
                <span style="color:#7f99b0">RV Fisiologia · RV App</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export const hostedAuthEmailConfig = {
  // Authentication emails
  mailer_subjects_confirmation: 'Confirme seu e-mail | RV App',
  mailer_templates_confirmation_content: emailShell({
    title: 'Confirme seu e-mail',
    body: 'Recebemos um cadastro usando este endereço. Confirme o e-mail para continuar com segurança no RV App.',
    ctaLabel: 'Confirmar e-mail',
    ctaUrl: '{{ .ConfirmationURL }}',
    footer: 'Se você não fez este cadastro, pode ignorar esta mensagem.',
  }),

  mailer_subjects_invite: 'Você foi convidado para o RV App',
  mailer_templates_invite_content: emailShell({
    title: 'Seu convite para o RV App',
    body: 'Você recebeu um convite para acessar o RV App. Use o botão abaixo para aceitar e continuar.',
    ctaLabel: 'Aceitar convite',
    ctaUrl: '{{ .ConfirmationURL }}',
    footer: 'Se você não esperava este convite, pode ignorar esta mensagem.',
  }),

  mailer_subjects_magic_link: 'Seu acesso ao RV App',
  mailer_templates_magic_link_content: emailShell({
    title: 'Acesse sua conta',
    body: 'Use o botão abaixo para entrar no RV App. Por segurança, este link é temporário e deve ser usado apenas por você.',
    ctaLabel: 'Entrar no RV App',
    ctaUrl: '{{ .ConfirmationURL }}',
    footer: 'Se você não solicitou este acesso, pode ignorar esta mensagem.',
  }),

  mailer_subjects_email_change: 'Confirme a alteração do seu e-mail | RV App',
  mailer_templates_email_change_content: emailShell({
    title: 'Confirme seu novo e-mail',
    body: 'Foi solicitada a alteração do e-mail da sua conta para <strong style="color:#f4f8fb">{{ .NewEmail }}</strong>. Confirme abaixo para concluir.',
    ctaLabel: 'Confirmar novo e-mail',
    ctaUrl: '{{ .ConfirmationURL }}',
    footer: 'Se você não pediu esta alteração, não confirme o link e mantenha sua conta protegida.',
  }),

  mailer_subjects_recovery: 'Recupere sua senha | RV App',
  mailer_templates_recovery_content: emailShell({
    title: 'Redefina sua senha',
    body: 'Recebemos uma solicitação para redefinir a senha da sua conta. Use o botão abaixo para escolher uma nova senha.',
    ctaLabel: 'Criar nova senha',
    ctaUrl: '{{ .ConfirmationURL }}',
    footer: 'Se você não solicitou a recuperação, pode ignorar esta mensagem. Sua senha atual continuará válida.',
  }),

  mailer_subjects_reauthentication: '{{ .Token }} é seu código de segurança | RV App',
  mailer_templates_reauthentication_content: emailShell({
    title: 'Confirme que é você',
    body: 'Use o código abaixo para confirmar uma ação sensível na sua conta. Ele expira em pouco tempo.',
    code: '{{ .Token }}',
    footer: 'Nunca compartilhe este código. A equipe RV não pede códigos de verificação por mensagem.',
  }),

  // Security notification emails
  mailer_notifications_password_changed_enabled: true,
  mailer_subjects_password_changed_notification: 'Sua senha foi alterada | RV App',
  mailer_templates_password_changed_notification_content: emailShell({
    title: 'Senha alterada',
    body: 'A senha da sua conta foi alterada recentemente. Se foi você, nenhuma ação adicional é necessária.',
    ctaLabel: 'Acessar RV App',
    ctaUrl: APP_URL,
    footer: 'Se você não reconhece esta alteração, recupere sua senha imediatamente.',
  }),

  mailer_notifications_email_changed_enabled: true,
  mailer_subjects_email_changed_notification: 'Seu e-mail foi alterado | RV App',
  mailer_templates_email_changed_notification_content: emailShell({
    title: 'E-mail alterado',
    body: 'O e-mail da sua conta foi alterado de <strong style="color:#f4f8fb">{{ .OldEmail }}</strong> para <strong style="color:#f4f8fb">{{ .Email }}</strong>.',
    ctaLabel: 'Acessar RV App',
    ctaUrl: APP_URL,
    footer: 'Se você não reconhece esta alteração, proteja sua conta imediatamente.',
  }),

  mailer_notifications_phone_changed_enabled: true,
  mailer_subjects_phone_changed_notification: 'Seu telefone foi alterado | RV App',
  mailer_templates_phone_changed_notification_content: emailShell({
    title: 'Telefone alterado',
    body: 'O telefone da sua conta foi alterado de <strong style="color:#f4f8fb">{{ .OldPhone }}</strong> para <strong style="color:#f4f8fb">{{ .Phone }}</strong>.',
    ctaLabel: 'Acessar RV App',
    ctaUrl: APP_URL,
    footer: 'Se você não reconhece esta alteração, proteja sua conta imediatamente.',
  }),

  mailer_notifications_identity_linked_enabled: true,
  mailer_subjects_identity_linked_notification: 'Novo método de acesso vinculado | RV App',
  mailer_templates_identity_linked_notification_content: emailShell({
    title: 'Método de acesso vinculado',
    body: 'Um acesso via <strong style="color:#f4f8fb">{{ .Provider }}</strong> foi vinculado à conta <strong style="color:#f4f8fb">{{ .Email }}</strong>.',
    ctaLabel: 'Acessar RV App',
    ctaUrl: APP_URL,
    footer: 'Se você não fez isso, revise a segurança da sua conta.',
  }),

  mailer_notifications_identity_unlinked_enabled: true,
  mailer_subjects_identity_unlinked_notification: 'Método de acesso removido | RV App',
  mailer_templates_identity_unlinked_notification_content: emailShell({
    title: 'Método de acesso removido',
    body: 'O acesso via <strong style="color:#f4f8fb">{{ .Provider }}</strong> foi removido da conta <strong style="color:#f4f8fb">{{ .Email }}</strong>.',
    ctaLabel: 'Acessar RV App',
    ctaUrl: APP_URL,
    footer: 'Se você não fez isso, revise a segurança da sua conta.',
  }),

  mailer_notifications_mfa_factor_enrolled_enabled: true,
  mailer_subjects_mfa_factor_enrolled_notification: 'Novo método de verificação adicionado | RV App',
  mailer_templates_mfa_factor_enrolled_notification_content: emailShell({
    title: 'Verificação adicionada',
    body: 'Um novo método de verificação <strong style="color:#f4f8fb">{{ .FactorType }}</strong> foi adicionado à sua conta.',
    ctaLabel: 'Acessar RV App',
    ctaUrl: APP_URL,
    footer: 'Se você não fez isso, revise a segurança da sua conta.',
  }),

  mailer_notifications_mfa_factor_unenrolled_enabled: true,
  mailer_subjects_mfa_factor_unenrolled_notification: 'Método de verificação removido | RV App',
  mailer_templates_mfa_factor_unenrolled_notification_content: emailShell({
    title: 'Verificação removida',
    body: 'O método de verificação <strong style="color:#f4f8fb">{{ .FactorType }}</strong> foi removido da sua conta.',
    ctaLabel: 'Acessar RV App',
    ctaUrl: APP_URL,
    footer: 'Se você não fez isso, revise a segurança da sua conta.',
  }),
}
