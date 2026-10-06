import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { appStorage } from './storage';
import { getOrCreateDeviceId } from './deviceIdentity';

const AUTH_USER_ID_KEY = 'LPT_AUTHENTICATED_USER_ID_V1';

type AuthListener = (user: User | null, isAnonymous: boolean) => void;

class AuthService {
  private currentUser: User | null = null;
  private currentSession: Session | null = null;
  private listeners = new Set<AuthListener>();
  private isInitializing = false;
  private initPromise: Promise<string> | null = null;
  private cachedUserId: string | null = null;

  constructor() {
    this.init();
  }

  public async init(): Promise<string> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.isInitializing = true;
      try {
        // 1. Lire le cache local immédiat pour 0ms de blocage
        const savedId = await appStorage.getItem(AUTH_USER_ID_KEY);
        if (savedId) {
          this.cachedUserId = savedId;
        }

        // 2. Vérifier la session Supabase existante
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!sessionError && session?.user) {
          this.currentSession = session;
          this.currentUser = session.user;
          this.cachedUserId = session.user.id;
          await appStorage.setItem(AUTH_USER_ID_KEY, session.user.id);
          this.notify();
          return session.user.id;
        }

        // 3. Pas de session active : initialisation Supabase Anonymous Auth
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

        if (!authError && authData?.user) {
          this.currentSession = authData.session;
          this.currentUser = authData.user;
          this.cachedUserId = authData.user.id;
          await appStorage.setItem(AUTH_USER_ID_KEY, authData.user.id);
          this.notify();
          return authData.user.id;
        }

        // 4. Fallback hors-ligne ou si Anonymous Auth non activé côté serveur
        console.info('[AuthService] Anonymous auth fallback to hardware device identity.');
        const fallbackId = await getOrCreateDeviceId();
        this.cachedUserId = fallbackId;
        await appStorage.setItem(AUTH_USER_ID_KEY, fallbackId);
        return fallbackId;
      } catch (err) {
        console.warn('[AuthService] Init warning:', err);
        const fallbackId = await getOrCreateDeviceId();
        this.cachedUserId = fallbackId;
        return fallbackId;
      } finally {
        this.isInitializing = false;

        // Écouter les changements de session (reconnexion, refresh, login ultérieur)
        supabase.auth.onAuthStateChange(async (event, newSession) => {
          this.currentSession = newSession;
          this.currentUser = newSession?.user ?? null;
          if (newSession?.user?.id) {
            this.cachedUserId = newSession.user.id;
            await appStorage.setItem(AUTH_USER_ID_KEY, newSession.user.id);
          }
          this.notify();
        });
      }
    })();

    return this.initPromise;
  }

  public getUserIdSync(): string {
    return this.cachedUserId || 'anonymous-user';
  }

  public async getUserId(): Promise<string> {
    if (this.cachedUserId) return this.cachedUserId;
    return await this.init();
  }

  public async getEffectiveUserId(): Promise<string> {
    return this.getUserId();
  }

  public getUser(): User | null {
    return this.currentUser;
  }

  public getSession(): Session | null {
    return this.currentSession;
  }

  public isAnonymous(): boolean {
    return this.currentUser?.is_anonymous !== false;
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.currentUser, this.isAnonymous());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentUser, this.isAnonymous());
      } catch (e) {}
    });
  }
}

export const authService = new AuthService();
