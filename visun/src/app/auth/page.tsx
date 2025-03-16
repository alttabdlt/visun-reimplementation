import { Header } from '@/components/Header';
import { AuthForm } from '@/components/auth/AuthForm';

export default function AuthPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container max-w-4xl mx-auto py-8 px-4">
        <AuthForm />
      </main>
    </div>
  );
}
