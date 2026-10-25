"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [notice, setNotice] = useState("");
  const isRegistering = mode === "register";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(
      isRegistering
        ? "The registration screen is ready; account creation will be connected to Person A's API."
        : "The login screen is ready; authentication will be connected to Person A's API.",
    );
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {isRegistering && (
        <>
          <label htmlFor="full-name">Full name</label>
          <input
            id="full-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            required
          />
        </>
      )}
      <label htmlFor="email">Work email</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        required
      />
      <div className="password-label">
        <label htmlFor="password">Password</label>
        {!isRegistering && (
          <button
            className="text-button"
            type="button"
            onClick={() =>
              setNotice(
                "Password recovery will be available after the authentication API is connected.",
              )
            }
          >
            Forgot password?
          </button>
        )}
      </div>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete={isRegistering ? "new-password" : "current-password"}
        placeholder={
          isRegistering ? "At least 8 characters" : "Enter your password"
        }
        minLength={8}
        required
      />
      <button className="button button-primary login-submit" type="submit">
        {isRegistering ? "Create account" : "Sign in"}
        <span aria-hidden="true">→</span>
      </button>
      {notice && (
        <p className="login-notice" role="status">
          {notice}
        </p>
      )}
      <p className="login-legal">
        By continuing, you agree to your organization&apos;s access and data
        handling policies.
      </p>
    </form>
  );
}

export function AuthSwitch({ mode }: { mode: "login" | "register" }) {
  const isRegistering = mode === "register";
  return (
    <p className="login-support">
      {isRegistering ? "Already have an account? " : "New to Talent Desk? "}
      <Link href={isRegistering ? "/login" : "/register"}>
        {isRegistering ? "Sign in" : "Create an account"}
      </Link>
    </p>
  );
}
