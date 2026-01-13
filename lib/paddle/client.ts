"use client";

/**
 * Paddle 클라이언트 초기화
 *
 * Paddle.js를 사용한 클라이언트 사이드 결제 처리
 */

import { initializePaddle, Paddle } from '@paddle/paddle-js';
import { PADDLE_CONFIG } from './config';

let paddleInstance: Paddle | undefined = undefined;
let initPromise: Promise<Paddle | undefined> | null = null;

/**
 * Paddle 인스턴스 초기화 (싱글톤)
 */
export async function getPaddleInstance(): Promise<Paddle | undefined> {
  // 이미 초기화되었으면 반환
  if (paddleInstance) {
    return paddleInstance;
  }

  // 초기화 중이면 대기
  if (initPromise) {
    return initPromise;
  }

  // 클라이언트 토큰 없으면 반환
  if (!PADDLE_CONFIG.clientToken) {
    console.warn('[Paddle] Client token not configured');
    return undefined;
  }

  // 초기화 시작
  initPromise = initializePaddle({
    token: PADDLE_CONFIG.clientToken,
    environment: PADDLE_CONFIG.environment,
  });

  paddleInstance = await initPromise;
  return paddleInstance;
}

/**
 * Checkout 열기
 */
export interface CheckoutOptions {
  priceId: string;
  customerId?: string;
  email?: string;
  successUrl?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

export async function openCheckout(options: CheckoutOptions): Promise<void> {
  const paddle = await getPaddleInstance();

  if (!paddle) {
    throw new Error('Paddle이 초기화되지 않았습니다.');
  }

  paddle.Checkout.open({
    items: [{ priceId: options.priceId, quantity: 1 }],
    customer: options.customerId ? { id: options.customerId } : undefined,
    customData: {
      email: options.email,
    },
    settings: {
      successUrl: options.successUrl || `${window.location.origin}/settings?checkout=success`,
      displayMode: 'overlay',
      theme: 'dark',
      locale: 'ko',
    },
  });
}
