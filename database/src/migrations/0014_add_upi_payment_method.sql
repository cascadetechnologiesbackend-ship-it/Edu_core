-- Migration: 0014_add_upi_payment_method.sql
-- Description: Add 'UPI' as a first-class value in the payment_method enum

ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'UPI';
