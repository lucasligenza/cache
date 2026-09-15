import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants';

interface Props {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  onSignUp: (email: string, password: string) => Promise<{ error: string | null; successMessage?: string }>;
  onGuest: () => Promise<{ error: string | null }>;
}

export function LoginScreen({ onSignIn, onSignUp, onGuest }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const command = mode === 'login' ? 'auth --login' : 'auth --register';
  const buttonLabel = mode === 'login' ? 'login' : 'register';

  const handleSubmit = async () => {
    setError(null);
    setSuccessMessage(null);
    if (mode === 'signup' && password.length < 8) {
      setError('password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    if (mode === 'login') {
      const result = await onSignIn(email, password);
      if (result.error) setError(result.error);
    } else {
      const result = await onSignUp(email, password);
      if (result.error) setError(result.error);
      else if (result.successMessage) {
        setSuccessMessage(result.successMessage);
        setMode('login');
        setPassword('');
      }
    }
    setSubmitting(false);
  };

  const handleGuest = async () => {
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);
    const result = await onGuest();
    if (result.error) {
      setError(
        /disabled/i.test(result.error)
          ? 'guest mode is off — enable anonymous sign-ins in supabase'
          : result.error,
      );
    }
    setSubmitting(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.prompt}>~/cache $ {command}</Text>
        <Text style={styles.sub}>
          {mode === 'login' ? 'sign in to your cache' : 'create a new cache'}
        </Text>

        <Text style={styles.label}>email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="user@example.com"
          placeholderTextColor={COLORS.textDim}
          accessibilityLabel="email"
        />

        <Text style={styles.label}>password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType={mode === 'login' ? 'password' : 'newPassword'}
          placeholder="••••••••"
          placeholderTextColor={COLORS.textDim}
          accessibilityLabel="password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {successMessage ? <Text style={styles.ok}>{successMessage}</Text> : null}

        <TouchableOpacity
          style={styles.submit}
          onPress={handleSubmit}
          disabled={submitting || !email || !password}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
        >
          <Text style={styles.submitText}>$ {submitting ? '…' : buttonLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setMode(m => (m === 'login' ? 'signup' : 'login'));
            setError(null);
            setSuccessMessage(null);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.toggle}>
            {mode === 'login' ? 'need an account? register' : 'already have one? login'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={styles.guest}
        onPress={handleGuest}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="continue as guest"
      >
        <Text style={styles.guestText}>continue as guest</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  prompt: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
    color: COLORS.accent,
    marginBottom: 6,
  },
  sub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 24,
  },
  label: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: COLORS.textDim,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  error: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.red,
    marginTop: 12,
  },
  ok: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.accent,
    marginTop: 12,
  },
  submit: {
    marginTop: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 4,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 14,
    color: COLORS.accent,
    letterSpacing: 1,
  },
  toggle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 16,
    textAlign: 'center',
  },
  guest: {
    marginHorizontal: 24,
    marginBottom: 12,
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.amber,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  guestText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 14,
    color: COLORS.amber,
    letterSpacing: 1,
  },
});
