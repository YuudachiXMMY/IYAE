package com.clossette.service;

import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthMailServiceTest {

    @Mock
    JavaMailSender mailSender;

    @InjectMocks
    AuthMailService authMailService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authMailService, "frontendBaseUrl", "http://localhost:3000");
        ReflectionTestUtils.setField(authMailService, "fromAddress", "noreply@clossette.com");
        ReflectionTestUtils.setField(authMailService, "resendEndpoint", "");
        ReflectionTestUtils.setField(authMailService, "internalMailSecret", "");
    }

    @Test
    void sendVerificationEmail_callsMailSender() {
        MimeMessage mimeMessage = new MimeMessage((Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        authMailService.sendVerificationEmail("user@example.com", "Test User", "rawtoken123");

        verify(mailSender, times(1)).send(any(MimeMessage.class));
    }

    @Test
    void sendVerificationEmail_setsCorrectRecipientAndSubject() throws MessagingException {
        MimeMessage mimeMessage = new MimeMessage((Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);

        authMailService.sendVerificationEmail("user@example.com", "Test User", "rawtoken123");

        verify(mailSender).send(captor.capture());
        MimeMessage sent = captor.getValue();
        assertThat(sent.getSubject()).isEqualTo("Verify your Clossette account");
        InternetAddress[] recipients = (InternetAddress[]) sent.getRecipients(MimeMessage.RecipientType.TO);
        assertThat(recipients).hasSize(1);
        assertThat(recipients[0].getAddress()).isEqualTo("user@example.com");
    }

    @Test
    void sendPasswordResetEmail_callsMailSender() {
        MimeMessage mimeMessage = new MimeMessage((Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        authMailService.sendPasswordResetEmail("user@example.com", "Test User", "resettoken456");

        verify(mailSender, times(1)).send(any(MimeMessage.class));
    }

    @Test
    void sendPasswordResetEmail_setsCorrectSubjectAndRecipient() throws MessagingException {
        MimeMessage mimeMessage = new MimeMessage((Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);

        authMailService.sendPasswordResetEmail("user@example.com", "Test User", "resettoken456");

        verify(mailSender).send(captor.capture());
        MimeMessage sent = captor.getValue();
        assertThat(sent.getSubject()).isEqualTo("Reset your Clossette password");
        InternetAddress[] recipients = (InternetAddress[]) sent.getRecipients(MimeMessage.RecipientType.TO);
        assertThat(recipients).hasSize(1);
        assertThat(recipients[0].getAddress()).isEqualTo("user@example.com");
    }

    @Test
    void sendHtmlEmail_onMailException_throwsEmailDeliveryException() {
        MimeMessage mimeMessage = new MimeMessage((Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        doThrow(new MailSendException("SMTP connection failed")).when(mailSender).send(any(MimeMessage.class));

        assertThatThrownBy(() ->
                authMailService.sendVerificationEmail("user@example.com", "Test User", "token"))
                .isInstanceOf(AuthMailService.EmailDeliveryException.class);
    }

    // ----- Resend path tests -----

    @Test
    void sendPasswordResetEmail_resendFails_fallsBackToSmtp() {
        // When Resend endpoint is set but the HTTP call fails (no real server),
        // the method should fall back to SMTP instead of throwing.
        ReflectionTestUtils.setField(authMailService, "resendEndpoint",
                "http://localhost:19999/api/internal/mail/password-reset");
        ReflectionTestUtils.setField(authMailService, "internalMailSecret", "test-secret");

        MimeMessage mimeMessage = new MimeMessage((Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        authMailService.sendPasswordResetEmail("user@example.com", "Test User", "tok");

        verify(mailSender, times(1)).send(any(MimeMessage.class));
    }

    @Test
    void sendPasswordResetEmail_resendFails_smtpAlsoFails_throwsEmailDeliveryException() {
        // When both Resend and SMTP fail, the method should throw.
        ReflectionTestUtils.setField(authMailService, "resendEndpoint",
                "http://localhost:19999/no-such-endpoint");
        ReflectionTestUtils.setField(authMailService, "internalMailSecret", "test-secret");

        MimeMessage mimeMessage = new MimeMessage((Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        doThrow(new MailSendException("SMTP also failed")).when(mailSender).send(any(MimeMessage.class));

        assertThatThrownBy(() ->
                authMailService.sendPasswordResetEmail("user@example.com", "Test User", "tok"))
                .isInstanceOf(AuthMailService.EmailDeliveryException.class);
    }

    @Test
    void sendPasswordResetEmail_noResendEndpoint_fallsBackToSmtp() {
        // resendEndpoint is blank (set in setUp) — must fall back to JavaMailSender
        MimeMessage mimeMessage = new MimeMessage((Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        authMailService.sendPasswordResetEmail("user@example.com", "Test User", "tok");

        verify(mailSender, times(1)).send(any(MimeMessage.class));
    }
}
