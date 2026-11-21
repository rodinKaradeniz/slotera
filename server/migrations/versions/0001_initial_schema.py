# ruff: noqa: E501
"""Complete pre-production schema, including tenant policies and fixed capabilities.

Edit this baseline in place until the first production release, then reset local databases.
The second revision owns the development showcase data.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Execute through the driver's simple-query protocol: function bodies contain semicolons.
SCHEMA_SQL = r"""
-- Restore explicit table ACLs without inheriting broad grants from an earlier local run.
ALTER DEFAULT PRIVILEGES FOR ROLE slotera_owner IN SCHEMA public REVOKE ALL ON TABLES FROM slotera_app;
ALTER DEFAULT PRIVILEGES FOR ROLE slotera_owner IN SCHEMA public REVOKE ALL ON SEQUENCES FROM slotera_app;
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: booking_approval_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_approval_status AS ENUM (
    'not_required',
    'pending',
    'approved',
    'declined'
);


--
-- Name: booking_attendance; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_attendance AS ENUM (
    'present',
    'late',
    'absent'
);


--
-- Name: booking_origin; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_origin AS ENUM (
    'operator',
    'public'
);


--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status AS ENUM (
    'pending',
    'confirmed',
    'completed',
    'cancelled',
    'noshow'
);


--
-- Name: confirmation_policy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.confirmation_policy AS ENUM (
    'automatic',
    'operator_approval'
);


--
-- Name: form_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_status AS ENUM (
    'active',
    'inactive'
);


--
-- Name: location_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.location_type AS ENUM (
    'online',
    'physical',
    'hybrid'
);


--
-- Name: membership_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.membership_role AS ENUM (
    'operator_admin'
);


--
-- Name: notification_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_kind AS ENUM (
    'booking_pending',
    'booking_confirmed',
    'payment_pending',
    'session_starting',
    'reschedule_requested',
    'booking_cancelled'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'paid',
    'pending',
    'refunded',
    'free',
    'overdue'
);


--
-- Name: platform_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.platform_role AS ENUM (
    'superadmin'
);


--
-- Name: service_booking_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.service_booking_mode AS ENUM (
    'open',
    'scheduled'
);


--
-- Name: session_action_item_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.session_action_item_status AS ENUM (
    'todo',
    'done'
);


--
-- Name: session_origin; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.session_origin AS ENUM (
    'operator',
    'public_open'
);


--
-- Name: session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.session_status AS ENUM (
    'scheduled',
    'live',
    'done',
    'cancelled'
);


--
-- Name: workspace_operational_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workspace_operational_status AS ENUM (
    'active',
    'suspended'
);


--
-- Name: slotera_activation_language(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_activation_language() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE chosen text;
        BEGIN
          SELECT email.template_data->>'language' INTO chosen
            FROM public.email_outbox email JOIN public.password_reset_tokens token
              ON token.id = email.related_password_reset_token_id
            WHERE token.user_id = NEW.id AND token.used_at IS NULL
              AND token.revoked_at IS NULL AND token.expires_at > statement_timestamp()
            ORDER BY token.created_at DESC LIMIT 1;
          IF chosen IN ('en','tr','de') THEN
            NEW.preferred_language := chosen;
          END IF;
          RETURN NEW;
        END $$;


--
-- Name: slotera_auth_change_password(bytea, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_auth_change_password(p_session_token_hash bytea, p_password_hash text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE
          current_session public.auth_sessions%ROWTYPE;
        BEGIN
          SELECT * INTO current_session
          FROM public.auth_sessions
          WHERE token_hash = p_session_token_hash
            AND revoked_at IS NULL
            AND expires_at > statement_timestamp()
          FOR UPDATE;
          IF NOT FOUND THEN
            RETURN 'session_invalid';
          END IF;

          UPDATE public.users
          SET password_hash = p_password_hash,
              updated_at = statement_timestamp()
          WHERE id = current_session.user_id;

          -- Every other device is signed out; this one stays signed in.
          UPDATE public.auth_sessions
          SET revoked_at = statement_timestamp()
          WHERE user_id = current_session.user_id
            AND id <> current_session.id
            AND revoked_at IS NULL;

          UPDATE public.password_reset_tokens
          SET revoked_at = statement_timestamp()
          WHERE user_id = current_session.user_id
            AND used_at IS NULL
            AND revoked_at IS NULL;

          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          )
          SELECT
            gen_random_uuid(), membership.workspace_id, current_session.user_id,
            'auth.password_changed', 'user', current_session.user_id, '{}'::jsonb
          FROM public.workspace_memberships AS membership
          WHERE membership.user_id = current_session.user_id;

          RETURN 'changed';
        END
        $$;


--
-- Name: slotera_auth_consume_password_reset(bytea, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_auth_consume_password_reset(p_token_hash bytea, p_password_hash text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE
          reset_row public.password_reset_tokens%ROWTYPE;
        BEGIN
          SELECT * INTO reset_row
          FROM public.password_reset_tokens
          WHERE token_hash = p_token_hash
          FOR UPDATE;

          IF NOT FOUND
             OR reset_row.used_at IS NOT NULL
             OR reset_row.revoked_at IS NOT NULL
             OR reset_row.expires_at <= statement_timestamp() THEN
            RETURN 'invalid_or_expired';
          END IF;

          UPDATE public.users
          SET password_hash = p_password_hash,
              updated_at = statement_timestamp()
          WHERE id = reset_row.user_id;

          UPDATE public.password_reset_tokens
          SET used_at = statement_timestamp()
          WHERE id = reset_row.id;

          UPDATE public.password_reset_tokens
          SET revoked_at = statement_timestamp()
          WHERE user_id = reset_row.user_id
            AND id <> reset_row.id
            AND used_at IS NULL
            AND revoked_at IS NULL;

          UPDATE public.auth_sessions
          SET revoked_at = statement_timestamp()
          WHERE user_id = reset_row.user_id
            AND revoked_at IS NULL;

          UPDATE public.email_outbox
          SET text_body = '[credential consumed]',
              last_error = CASE
                WHEN sent_at IS NULL THEN 'credential consumed before delivery'
                ELSE last_error
              END,
              sent_at = COALESCE(sent_at, statement_timestamp())
          WHERE related_password_reset_token_id = reset_row.id
            AND sent_at IS NULL;

          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          )
          SELECT
            gen_random_uuid(),
            membership.workspace_id,
            reset_row.user_id,
            'auth.password_set',
            'user',
            reset_row.user_id,
            '{}'::jsonb
          FROM public.workspace_memberships AS membership
          WHERE membership.user_id = reset_row.user_id;

          RETURN 'consumed';
        END
        $$;


--
-- Name: slotera_auth_create_session(uuid, uuid, uuid, bytea, bytea, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_auth_create_session(p_session_id uuid, p_user_id uuid, p_workspace_id uuid, p_token_hash bytea, p_csrf_token_hash bytea, p_expires_at timestamp with time zone) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
        DECLARE
          identity_is_valid boolean;
        BEGIN
          SELECT CASE
            WHEN u.platform_role::text = 'superadmin' THEN p_workspace_id IS NULL
            WHEN u.platform_role IS NULL AND p_workspace_id IS NOT NULL THEN EXISTS (
              SELECT 1
              FROM public.workspace_memberships AS m
              WHERE m.user_id = u.id
                AND m.workspace_id = p_workspace_id
                AND m.role::text = 'operator_admin'
                AND EXISTS (
                  SELECT 1 FROM public.workspaces AS w
                  WHERE w.id = p_workspace_id
                    AND w.operational_status::text = 'active'
                )
            )
            ELSE false
          END
          INTO identity_is_valid
          FROM public.users AS u
          WHERE u.id = p_user_id;

          IF identity_is_valid IS NOT TRUE OR p_expires_at <= statement_timestamp() THEN
            RETURN false;
          END IF;

          INSERT INTO public.auth_sessions (
            id,
            user_id,
            active_workspace_id,
            token_hash,
            csrf_token_hash,
            expires_at
          )
          VALUES (
            p_session_id,
            p_user_id,
            p_workspace_id,
            p_token_hash,
            p_csrf_token_hash,
            p_expires_at
          );
          RETURN true;
        END
        $$;


--
-- Name: slotera_auth_login_identity(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_auth_login_identity(p_email text) RETURNS TABLE(user_id uuid, email text, title text, first_names text, last_name text, password_hash text, platform_role text, workspace_id uuid, workspace_name text, workspace_slug text, workspace_operational_status text, membership_role text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
          SELECT
            u.id,
            u.email::text,
            u.title::text,
            u.first_names::text,
            u.last_name::text,
            u.password_hash::text,
            u.platform_role::text,
            m.workspace_id,
            w.name::text,
            w.slug::text,
            w.operational_status::text,
            m.role::text
          FROM public.users AS u
          LEFT JOIN public.workspace_memberships AS m ON m.user_id = u.id
          LEFT JOIN public.workspaces AS w ON w.id = m.workspace_id
          WHERE u.email = lower(btrim(p_email))
          ORDER BY m.created_at NULLS FIRST
        $$;


--
-- Name: slotera_auth_maintenance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_auth_maintenance() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE
          affected integer := 0;
          row_count integer;
        BEGIN
          DELETE FROM public.auth_sessions
          WHERE expires_at < statement_timestamp() - interval '7 days'
             OR revoked_at < statement_timestamp() - interval '30 days';
          GET DIAGNOSTICS row_count = ROW_COUNT;
          affected := affected + row_count;

          DELETE FROM public.password_reset_tokens
          WHERE expires_at < statement_timestamp() - interval '7 days'
             OR used_at < statement_timestamp() - interval '30 days'
             OR revoked_at < statement_timestamp() - interval '30 days';
          GET DIAGNOSTICS row_count = ROW_COUNT;
          affected := affected + row_count;

          DELETE FROM public.request_rate_limits
          WHERE window_started_at < statement_timestamp() - interval '2 days';
          GET DIAGNOSTICS row_count = ROW_COUNT;
          affected := affected + row_count;

          DELETE FROM public.email_outbox
          WHERE sent_at < statement_timestamp() - interval '30 days';
          GET DIAGNOSTICS row_count = ROW_COUNT;
          RETURN affected + row_count;
        END
        $$;


--
-- Name: slotera_auth_preferences(bytea, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_auth_preferences(p_token_hash bytea, p_language text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE actor uuid; result text;
        BEGIN
          SELECT s.user_id INTO actor FROM public.slotera_auth_session(p_token_hash) s;
          IF actor IS NULL THEN RETURN NULL; END IF;
          IF p_language IS NOT NULL THEN
            IF p_language NOT IN ('en','tr','de') THEN RAISE EXCEPTION 'invalid_language'; END IF;
            UPDATE public.users SET preferred_language = p_language WHERE id = actor;
          END IF;
          SELECT preferred_language INTO result FROM public.users WHERE id = actor;
          RETURN result;
        END $$;


--
-- Name: slotera_auth_request_password_reset(uuid, uuid, text, bytea, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_auth_request_password_reset(p_token_id uuid, p_outbox_id uuid, p_email text, p_token_hash bytea, p_expires_at timestamp with time zone, p_reset_url text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE
          target_user public.users%ROWTYPE;
        BEGIN
          IF octet_length(p_token_hash) <> 32
             OR p_expires_at <= statement_timestamp()
             OR char_length(p_reset_url) > 4000 THEN
            RETURN false;
          END IF;

          SELECT * INTO target_user
          FROM public.users
          WHERE email = lower(btrim(p_email));

          IF NOT FOUND THEN
            RETURN false;
          END IF;

          UPDATE public.password_reset_tokens
          SET revoked_at = statement_timestamp()
          WHERE user_id = target_user.id
            AND used_at IS NULL
            AND revoked_at IS NULL;

          INSERT INTO public.password_reset_tokens (
            id, user_id, token_hash, expires_at
          ) VALUES (
            p_token_id, target_user.id, p_token_hash, p_expires_at
          );

          INSERT INTO public.email_outbox (
            id,
            kind,
            recipient_email,
            subject,
            text_body,
            related_password_reset_token_id
          ) VALUES (
            p_outbox_id,
            'account_activation',
            target_user.email,
            'Activate or reset your Slotera account',
            concat(
              'Hello ', target_user.first_names, E',

',
              'Use this one-time link to activate or reset your Slotera account:
',
              p_reset_url,
              E'

This link expires at ',
              to_char(p_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC'),
              '. If you did not request it, ignore this email.'
            ),
            p_token_id
          );
          RETURN true;
        END
        $$;


--
-- Name: slotera_auth_revoke_session(bytea); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_auth_revoke_session(p_token_hash bytea) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
        BEGIN
          UPDATE public.auth_sessions
          SET revoked_at = statement_timestamp()
          WHERE token_hash = p_token_hash
            AND revoked_at IS NULL;
          RETURN FOUND;
        END
        $$;


--
-- Name: slotera_auth_self_signup(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_auth_self_signup(p_workspace_id uuid, p_owner_user_id uuid, p_membership_id uuid, p_audit_event_id uuid, p_name text, p_slug text, p_owner_first_names text, p_owner_last_name text, p_owner_email text, p_timezone text, p_currency text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        BEGIN
          -- The new owner is the actor of their own sign-up.
          RETURN public.slotera_workspace_create_with_owner(
            p_workspace_id, p_owner_user_id, p_membership_id, p_audit_event_id,
            p_owner_user_id, 'auth.workspace_signup', p_name, p_slug,
            p_owner_first_names, p_owner_last_name, p_owner_email, p_timezone, p_currency
          );
        END
        $$;


--
-- Name: slotera_auth_session(bytea); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_auth_session(p_token_hash bytea) RETURNS TABLE(session_id uuid, user_id uuid, email text, title text, first_names text, last_name text, role text, workspace_id uuid, workspace_name text, workspace_slug text, csrf_token_hash bytea, expires_at timestamp with time zone, preferred_language text, workspace_currency text, workspace_timezone text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
          SELECT
            s.id,
            u.id,
            u.email::text,
            u.title::text,
            u.first_names::text,
            u.last_name::text,
            COALESCE(u.platform_role::text, m.role::text),
            s.active_workspace_id,
            w.name::text,
            w.slug::text,
            s.csrf_token_hash,
            s.expires_at,
            u.preferred_language::text,
            w.currency::text,
            w.timezone::text
          FROM public.auth_sessions AS s
          JOIN public.users AS u ON u.id = s.user_id
          LEFT JOIN public.workspace_memberships AS m
            ON m.user_id = s.user_id
           AND m.workspace_id = s.active_workspace_id
          LEFT JOIN public.workspaces AS w ON w.id = s.active_workspace_id
          WHERE s.token_hash = p_token_hash
            AND s.revoked_at IS NULL
            AND s.expires_at > statement_timestamp()
            AND (
              (u.platform_role::text = 'superadmin' AND s.active_workspace_id IS NULL)
              OR (
                u.platform_role IS NULL
                AND s.active_workspace_id IS NOT NULL
                AND m.role::text = 'operator_admin'
                AND w.operational_status::text = 'active'
              )
            )
        $$;


--
-- Name: slotera_auth_slug_available(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_auth_slug_available(p_slug text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
          SELECT NOT EXISTS (SELECT 1 FROM public.reserved_workspace_slugs WHERE slug = p_slug)
             AND NOT EXISTS (SELECT 1 FROM public.workspaces WHERE slug = p_slug)
        $$;


--
-- Name: slotera_booking_due_reminders(interval); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_booking_due_reminders(p_within interval) RETURNS TABLE(workspace_id uuid, booking_id uuid, ends_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
          SELECT booking.workspace_id, booking.id, scheduled_session.end_at
          FROM public.bookings AS booking
          JOIN public.sessions AS scheduled_session
            ON scheduled_session.workspace_id = booking.workspace_id
           AND scheduled_session.id = booking.session_id
          WHERE booking.status::text = 'confirmed'
            AND booking.customer_email <> ''
            AND scheduled_session.start_at > statement_timestamp()
            AND scheduled_session.start_at <= statement_timestamp() + p_within
            AND NOT EXISTS (
              SELECT 1 FROM public.email_outbox AS outbox
              WHERE outbox.related_booking_id = booking.id
                AND outbox.kind = 'booking_reminder'
                AND outbox.suppressed_at IS NULL
                AND outbox.event_key = floor(extract(epoch FROM scheduled_session.start_at))::bigint::text
            )
          ORDER BY scheduled_session.start_at
          LIMIT 500
        $$;


--
-- Name: slotera_booking_emit_event(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_booking_emit_event(p_booking_id uuid, p_event text, p_manage_url text DEFAULT NULL::text, p_event_key text DEFAULT '', p_notify_operator boolean DEFAULT true) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE
          current_workspace_id uuid := public.slotera_current_workspace_id();
          target record;
          queued_id uuid;
          recipient_user_id uuid;
          notification_kind_value public.notification_kind;
          email_kind text;
          notification_payload jsonb;
        BEGIN
          IF current_workspace_id IS NULL OR p_event NOT IN (
            'received', 'confirmed', 'reminder', 'rescheduled', 'cancelled', 'details'
          ) THEN
            RETURN false;
          END IF;

          SELECT
            booking.id,
            booking.reference,
            booking.customer_email,
            coalesce(booking.delivery_email_override, booking.customer_email) AS email_contact,
            booking.approval_status::text AS approval_status,
            booking.payment_status::text AS payment_status,
            booking.payment_method,
            booking.amount_cents,
            booking.currency,
            booking.payment_due_at,
            booking.manual_payment_instructions_snapshot,
            booking.status::text AS booking_status,
            scheduled_session.start_at,
            scheduled_session.end_at,
            scheduled_session.location_type::text AS location_type,
            scheduled_session.location,
            scheduled_session.address,
            service.meeting_url,
            service.name AS service_name,
            service.cancellation_rule,
            workspace.timezone,
            profile.display_name AS provider_name
          INTO target
          FROM public.bookings AS booking
          JOIN public.sessions AS scheduled_session
            ON scheduled_session.workspace_id = booking.workspace_id
           AND scheduled_session.id = booking.session_id
          JOIN public.services AS service
            ON service.workspace_id = scheduled_session.workspace_id
           AND service.id = scheduled_session.service_id
          JOIN public.workspaces AS workspace ON workspace.id = booking.workspace_id
          JOIN public.workspace_business_profiles AS profile
            ON profile.workspace_id = booking.workspace_id
          WHERE booking.workspace_id = current_workspace_id
            AND booking.id = p_booking_id;

          IF NOT FOUND OR target.customer_email = '' OR target.email_contact = '' THEN
            RETURN false;
          END IF;
          IF (p_event = 'received' AND target.booking_status <> 'pending')
             OR (p_event IN ('confirmed', 'reminder') AND target.booking_status <> 'confirmed')
             OR (p_event = 'rescheduled'
                 AND target.booking_status NOT IN ('pending', 'confirmed'))
             OR (p_event = 'cancelled' AND target.booking_status <> 'cancelled') THEN
            RETURN false;
          END IF;

          email_kind := 'booking_' || p_event;
          notification_kind_value := CASE p_event
            WHEN 'received' THEN 'booking_pending'::public.notification_kind
            WHEN 'confirmed' THEN 'booking_confirmed'::public.notification_kind
            WHEN 'rescheduled' THEN 'reschedule_requested'::public.notification_kind
            WHEN 'cancelled' THEN 'booking_cancelled'::public.notification_kind
            ELSE NULL
          END;

          -- Reminders go to the customer only; every other event also tells the operator.
          IF p_notify_operator AND notification_kind_value IS NOT NULL THEN
            SELECT membership.user_id
            INTO recipient_user_id
            FROM public.workspace_memberships AS membership
            WHERE membership.workspace_id = current_workspace_id
              AND membership.role::text = 'operator_admin'
            ORDER BY membership.created_at, membership.id
            LIMIT 1;
            IF recipient_user_id IS NULL THEN
              RETURN false;
            END IF;
            notification_payload := CASE p_event
              WHEN 'received' THEN jsonb_build_object(
                'approvalStatus', target.approval_status,
                'paymentStatus', target.payment_status,
                'amountCents', target.amount_cents,
                'currency', target.currency,
                'startsAt', target.start_at
              )
              WHEN 'rescheduled' THEN jsonb_build_object('requestedFor', target.start_at)
              ELSE jsonb_build_object('startsAt', target.start_at)
            END;
            INSERT INTO public.notifications (
              id, workspace_id, recipient_user_id, kind, payload,
              resource_type, resource_id
            ) VALUES (
              gen_random_uuid(), current_workspace_id, recipient_user_id,
              notification_kind_value, notification_payload, 'booking', target.id
            )
            ON CONFLICT ON CONSTRAINT uq_notifications_resource_event DO NOTHING;
          END IF;

          INSERT INTO public.email_outbox (
            id, kind, recipient_email, subject, text_body, template_data,
            related_booking_id, event_key
          ) VALUES (
            gen_random_uuid(), email_kind, target.email_contact,
            concat('[template:', email_kind, ']'),
            concat('[template:', email_kind, ']'),
            jsonb_build_object(
              'reference', target.reference,
              'bookingStatus', target.booking_status,
              'serviceName', target.service_name,
              'providerName', target.provider_name,
              'startsAt', target.start_at,
              'endsAt', target.end_at,
              'timezone', target.timezone,
              'paymentMethod', target.payment_method,
              'paymentStatus', target.payment_status,
              'approvalStatus', target.approval_status,
              'amountCents', target.amount_cents,
              'currency', target.currency,
              'paymentDueAt', target.payment_due_at,
              'manualPaymentInstructions', target.manual_payment_instructions_snapshot,
              'cancellationRule', target.cancellation_rule,
              'manageUrl', p_manage_url,
              'locationType', target.location_type,
              'location', target.location,
              'address', target.address,
              'meetingUrl', CASE
                WHEN target.booking_status = 'confirmed' AND p_event <> 'cancelled'
                THEN target.meeting_url
              END
            ),
            target.id, p_event_key
          )
          ON CONFLICT ON CONSTRAINT uq_email_outbox_booking_event DO NOTHING
          RETURNING id INTO queued_id;
          RETURN queued_id IS NOT NULL;
        END
$$;


--
-- Name: slotera_booking_notify_client_moved(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_booking_notify_client_moved(p_booking_id uuid, p_manage_url text) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
    AS $$ SELECT public.slotera_booking_emit_event(p_booking_id, 'rescheduled', p_manage_url, gen_random_uuid()::text, false); $$;


--
-- Name: slotera_booking_notify_operator(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_booking_notify_operator(p_booking_id uuid, p_event text, p_admin_url text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE
          current_workspace_id uuid := public.slotera_current_workspace_id();
          target record;
          owner_email text;
        BEGIN
          IF current_workspace_id IS NULL
             OR p_event NOT IN ('new', 'cancelled', 'rescheduled') THEN
            RETURN false;
          END IF;

          SELECT
            booking.id,
            booking.reference,
            concat_ws(' ', nullif(booking.customer_first_name, ''),
                      nullif(booking.customer_last_name, '')) AS client_name,
            booking.status::text AS booking_status,
            booking.approval_status::text AS approval_status,
            booking.payment_status::text AS payment_status,
            scheduled_session.start_at,
            service.name AS service_name,
            workspace.timezone
          INTO target
          FROM public.bookings AS booking
          JOIN public.sessions AS scheduled_session
            ON scheduled_session.workspace_id = booking.workspace_id
           AND scheduled_session.id = booking.session_id
          JOIN public.services AS service
            ON service.workspace_id = scheduled_session.workspace_id
           AND service.id = scheduled_session.service_id
          JOIN public.workspaces AS workspace ON workspace.id = booking.workspace_id
          WHERE booking.workspace_id = current_workspace_id
            AND booking.id = p_booking_id;
          IF NOT FOUND THEN
            RETURN false;
          END IF;

          SELECT u.email::text INTO owner_email
          FROM public.workspace_memberships AS membership
          JOIN public.users AS u ON u.id = membership.user_id
          WHERE membership.workspace_id = current_workspace_id
            AND membership.role::text = 'operator_admin'
          ORDER BY membership.created_at, membership.id
          LIMIT 1;
          IF owner_email IS NULL THEN
            RETURN false;
          END IF;

          INSERT INTO public.email_outbox (
            id, kind, recipient_email, subject, text_body, template_data,
            related_booking_id
          ) VALUES (
            gen_random_uuid(),
            'operator_booking_' || p_event,
            owner_email,
            concat('[template:operator_booking_', p_event, ']'),
            concat('[template:operator_booking_', p_event, ']'),
            jsonb_build_object(
              'reference', target.reference,
              'serviceName', target.service_name,
              'clientName', target.client_name,
              'startsAt', target.start_at,
              'timezone', target.timezone,
              'bookingStatus', target.booking_status,
              'approvalStatus', target.approval_status,
              'paymentStatus', target.payment_status,
              'adminUrl', p_admin_url
            ),
            target.id
          )
          ON CONFLICT ON CONSTRAINT uq_email_outbox_booking_event DO NOTHING;
          RETURN true;
        END
        $$;


--
-- Name: slotera_calendar_feed_resolve(bytea); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_calendar_feed_resolve(p_token_hash bytea) RETURNS TABLE(workspace_id uuid, user_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
          SELECT feed.workspace_id, feed.user_id
          FROM public.calendar_feed_tokens AS feed
          JOIN public.workspaces AS workspace ON workspace.id = feed.workspace_id
          WHERE feed.token_hash = p_token_hash
            AND feed.revoked_at IS NULL
            AND workspace.operational_status::text = 'active'
        $$;


--
-- Name: slotera_client_erase_outbox(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_client_erase_outbox(p_client_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE
          tenant uuid := public.slotera_current_workspace_id();
          affected integer;
        BEGIN
          IF tenant IS NULL THEN
            RETURN 0;
          END IF;
          WITH client_bookings AS (
            SELECT booking.id FROM public.bookings AS booking
            WHERE booking.workspace_id = tenant AND booking.client_id = p_client_id
          ),
          removed AS (
            DELETE FROM public.email_outbox AS outbox
            USING client_bookings
            WHERE outbox.related_booking_id = client_bookings.id AND outbox.sent_at IS NULL
            RETURNING 1
          ),
          redacted AS (
            UPDATE public.email_outbox AS outbox
            SET recipient_email = 'erased@invalid', subject = '[erased]', text_body = '',
                template_data = '{}'::jsonb, last_error = NULL
            FROM client_bookings
            WHERE outbox.related_booking_id = client_bookings.id
              AND outbox.sent_at IS NOT NULL
            RETURNING 1
          )
          SELECT (SELECT count(*) FROM removed) + (SELECT count(*) FROM redacted)
          INTO affected;
          RETURN affected;
        END
        $$;


--
-- Name: slotera_current_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_current_user_id() RETURNS uuid
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
          SELECT NULLIF(pg_catalog.current_setting('app.current_user_id', true), '')::uuid
        $$;


--
-- Name: slotera_current_workspace_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_current_workspace_id() RETURNS uuid
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
          SELECT NULLIF(pg_catalog.current_setting('app.current_workspace_id', true), '')::uuid
        $$;


--
-- Name: slotera_email_claim(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_email_claim() RETURNS TABLE(id uuid, kind text, recipient_email text, subject text, text_body text, template_data jsonb, attempt_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        BEGIN
          -- A worker that dies on its final attempt must not leave an eternal claim.
          WITH expired AS (
            SELECT item.id FROM public.email_outbox AS item
            WHERE item.sent_at IS NULL AND item.suppressed_at IS NULL
              AND item.attempt_count >= 10
              AND item.claimed_at < statement_timestamp() - interval '5 minutes'
            ORDER BY item.claimed_at, item.id
            FOR UPDATE SKIP LOCKED LIMIT 100
          )
          UPDATE public.email_outbox AS item
          SET claimed_at = NULL, last_error = 'delivery attempt lease expired'
          FROM expired WHERE item.id = expired.id;
          UPDATE public.email_outbox AS suppressed SET suppressed_at=statement_timestamp(),text_body='[superseded]'
          WHERE suppressed.id IN(SELECT e.id FROM public.email_outbox e WHERE e.sent_at IS NULL AND e.suppressed_at IS NULL AND (e.claimed_at IS NULL OR e.claimed_at<statement_timestamp()-interval '5 minutes')
          AND e.kind IN ('client_sign_in','message_digest','booking_followup') AND NOT public.slotera_client_mail_eligible(e.id) ORDER BY e.created_at,e.id FOR UPDATE SKIP LOCKED LIMIT 100);
          RETURN QUERY
          WITH candidate AS (
            SELECT item.id
            FROM public.email_outbox AS item
            WHERE item.sent_at IS NULL
              AND item.suppressed_at IS NULL
              AND (item.kind NOT IN ('client_sign_in','message_digest','booking_followup') OR public.slotera_client_mail_eligible(item.id))
              AND item.available_at <= statement_timestamp()
              AND (
                item.claimed_at IS NULL
                OR item.claimed_at < statement_timestamp() - interval '5 minutes'
              )
              AND item.attempt_count < 10
            ORDER BY item.created_at, item.id
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          UPDATE public.email_outbox AS item
          SET claimed_at = statement_timestamp(),
              attempt_count = item.attempt_count + 1
          FROM candidate
          WHERE item.id = candidate.id
          RETURNING 
            item.id,
            item.kind::text,
            item.recipient_email::text,
            item.subject::text,
            item.text_body,
            item.template_data,
            item.attempt_count
        ;
        END
        $$;


--
-- Name: slotera_email_mark_failed(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_email_mark_failed(p_id uuid, p_error text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        BEGIN
          UPDATE public.email_outbox
          SET claimed_at = NULL,
              last_error = left(p_error, 1000),
              available_at = statement_timestamp()
                + make_interval(secs => LEAST(3600, 30 * power(2, attempt_count)::integer))
          WHERE id = p_id AND sent_at IS NULL AND suppressed_at IS NULL;
          RETURN FOUND;
        END
        $$;


--
-- Name: slotera_email_mark_sent(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_email_mark_sent(p_id uuid, p_provider_message_id text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        BEGIN
          UPDATE public.email_outbox
          SET sent_at = statement_timestamp(),
              provider_message_id = p_provider_message_id,
              claimed_at = NULL,
              last_error = NULL,
              text_body = '[delivered]',
              template_data = '{}'::jsonb
          WHERE id = p_id AND sent_at IS NULL AND suppressed_at IS NULL;
          RETURN FOUND;
        END
        $$;


--
-- Name: slotera_email_snapshot_language(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_email_snapshot_language() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $_$
        DECLARE chosen text := 'en'; url text; first_name text; expiry timestamptz;
        BEGIN
          IF NEW.kind = 'account_activation' THEN
            SELECT u.first_names, t.expires_at, u.preferred_language INTO first_name, expiry, chosen
              FROM public.password_reset_tokens t JOIN public.users u ON u.id = t.user_id
              WHERE t.id = NEW.related_password_reset_token_id;
            url := substring(NEW.text_body from 'https?://[^[:space:]]+');
            IF url ~ '[?&]lang=(en|tr|de)(&|$)' THEN
              chosen := substring(url from '[?&]lang=(en|tr|de)');
            END IF;
            NEW.template_data := coalesce(NEW.template_data, '{}'::jsonb) || jsonb_build_object(
              'resetUrl', url, 'firstName', first_name, 'expiresAt', expiry);
          ELSIF NEW.kind LIKE 'operator_booking_%' THEN
            SELECT u.preferred_language INTO chosen FROM public.users u
              WHERE u.email = NEW.recipient_email;
          ELSIF NEW.related_booking_id IS NOT NULL THEN
            SELECT b.language INTO chosen FROM public.bookings b WHERE b.id = NEW.related_booking_id;
          END IF;
          NEW.template_data := coalesce(NEW.template_data, '{}'::jsonb)
            || jsonb_build_object('language', coalesce(chosen, 'en'));
          RETURN NEW;
        END $_$;


--
-- Name: slotera_platform_cancel_workspace_closure(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_platform_cancel_workspace_closure(p_workspace_id uuid, p_actor_user_id uuid, p_audit_event_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        BEGIN
          
          IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor_user_id AND platform_role::text = 'superadmin'
          ) THEN
            RETURN 'actor_not_superadmin';
          END IF;

          UPDATE public.workspaces
          SET closure_requested_at = NULL,
              operational_status = 'active',
              updated_at = statement_timestamp()
          WHERE id = p_workspace_id AND closure_requested_at IS NOT NULL;
          IF NOT FOUND THEN
            RETURN 'not_closing';
          END IF;

          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          )
          VALUES (
            p_audit_event_id, p_workspace_id, p_actor_user_id,
            'platform.workspace_closure_cancelled', 'workspace', p_workspace_id, '{}'::jsonb
          );
          RETURN 'cancelled';
        END
        $$;


--
-- Name: slotera_platform_get_workspace(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_platform_get_workspace(p_workspace_id uuid) RETURNS TABLE(id uuid, name text, slug text, owner_name text, owner_email text, created_at timestamp with time zone, currency text, timezone text, operational_status text, plan text, billing_interval text, trial_ends_at timestamp with time zone, paid_through date, closure_requested_at timestamp with time zone, services_count integer, clients_count integer, bookings_count integer, sessions_count integer, billing_version bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
          
    SELECT
      w.id,
      w.name::text,
      w.slug::text,
      owner.owner_name,
      owner.owner_email,
      w.created_at,
      w.currency::text,
      w.timezone::text,
      w.operational_status::text,
      w.plan::text,
      w.billing_interval::text,
      w.trial_ends_at,
      w.paid_through,
      w.closure_requested_at,
      service_facts.services_count,
      client_facts.clients_count,
      booking_facts.bookings_count,
      session_facts.sessions_count,
      w.billing_version
    FROM public.workspaces AS w
    LEFT JOIN LATERAL (
      SELECT
        concat_ws(' ', u.first_names, u.last_name)::text AS owner_name,
        u.email::text AS owner_email
      FROM public.workspace_memberships AS membership
      JOIN public.users AS u ON u.id = membership.user_id
      WHERE membership.workspace_id = w.id
      ORDER BY membership.created_at, membership.id
      LIMIT 1
    ) AS owner ON true
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS services_count
      FROM public.services AS service WHERE service.workspace_id = w.id
    ) AS service_facts
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS clients_count
      FROM public.clients AS client WHERE client.workspace_id = w.id
    ) AS client_facts
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS bookings_count
      FROM public.bookings AS booking WHERE booking.workspace_id = w.id
    ) AS booking_facts
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS sessions_count
      FROM public.sessions AS session_item WHERE session_item.workspace_id = w.id
    ) AS session_facts

          WHERE w.id = p_workspace_id
        $$;


--
-- Name: slotera_platform_list_inquiries(uuid, integer, integer, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_platform_list_inquiries(p_actor_user_id uuid, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_search text DEFAULT '', p_reason text DEFAULT '', p_read text DEFAULT '', p_id uuid DEFAULT NULL) RETURNS TABLE(id uuid, name text, email text, company text, reason text, message text, created_at timestamp with time zone, read_at timestamp with time zone, total_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
          SELECT i.id, i.name::text, i.email::text, i.company::text, i.reason::text,
                 i.message::text, i.created_at, i.read_at, count(*) OVER ()
          FROM public.platform_inquiries AS i
          WHERE EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor_user_id AND platform_role::text = 'superadmin'
          )
          AND (p_id IS NULL OR i.id = p_id)
          AND (p_search = '' OR strpos(lower(concat_ws(' ', i.name, i.email, i.company, i.message)), lower(btrim(p_search))) > 0)
          AND (p_reason = '' OR i.reason::text = p_reason)
          AND (p_read = '' OR (p_read = 'read' AND i.read_at IS NOT NULL) OR (p_read = 'unread' AND i.read_at IS NULL))
          ORDER BY i.created_at DESC, i.id DESC
          LIMIT LEAST(GREATEST(p_limit, 1), 100) OFFSET GREATEST(p_offset, 0)
        $$;


--
-- Name: slotera_platform_list_workspaces(integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_platform_list_workspaces(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_search text DEFAULT '') RETURNS TABLE(id uuid, name text, slug text, owner_name text, owner_email text, created_at timestamp with time zone, currency text, timezone text, operational_status text, plan text, billing_interval text, trial_ends_at timestamp with time zone, paid_through date, closure_requested_at timestamp with time zone, services_count integer, clients_count integer, bookings_count integer, sessions_count integer, billing_version bigint, total_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
          
    SELECT
      w.id,
      w.name::text,
      w.slug::text,
      owner.owner_name,
      owner.owner_email,
      w.created_at,
      w.currency::text,
      w.timezone::text,
      w.operational_status::text,
      w.plan::text,
      w.billing_interval::text,
      w.trial_ends_at,
      w.paid_through,
      w.closure_requested_at,
      service_facts.services_count,
      client_facts.clients_count,
      booking_facts.bookings_count,
      session_facts.sessions_count,
      w.billing_version,
      count(*) OVER ()
    FROM public.workspaces AS w
    LEFT JOIN LATERAL (
      SELECT
        concat_ws(' ', u.first_names, u.last_name)::text AS owner_name,
        u.email::text AS owner_email
      FROM public.workspace_memberships AS membership
      JOIN public.users AS u ON u.id = membership.user_id
      WHERE membership.workspace_id = w.id
      ORDER BY membership.created_at, membership.id
      LIMIT 1
    ) AS owner ON true
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS services_count
      FROM public.services AS service WHERE service.workspace_id = w.id
    ) AS service_facts
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS clients_count
      FROM public.clients AS client WHERE client.workspace_id = w.id
    ) AS client_facts
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS bookings_count
      FROM public.bookings AS booking WHERE booking.workspace_id = w.id
    ) AS booking_facts
    CROSS JOIN LATERAL (
      SELECT count(*)::integer AS sessions_count
      FROM public.sessions AS session_item WHERE session_item.workspace_id = w.id
    ) AS session_facts

          WHERE p_search = '' OR strpos(lower(concat_ws(' ', w.name, owner.owner_name, owner.owner_email)), lower(btrim(p_search))) > 0
          ORDER BY w.created_at DESC, w.id DESC
          LIMIT LEAST(GREATEST(p_limit, 1), 200)
          OFFSET GREATEST(p_offset, 0)
        $$;


--
-- Name: slotera_platform_mark_inquiry_read(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_platform_mark_inquiry_read(p_actor_user_id uuid, p_inquiry_id uuid, p_read boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        BEGIN
          
          IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor_user_id AND platform_role::text = 'superadmin'
          ) THEN
            RETURN 'actor_not_superadmin';
          END IF;

          UPDATE public.platform_inquiries
          SET read_at = CASE WHEN p_read THEN COALESCE(read_at, statement_timestamp()) END
          WHERE id = p_inquiry_id;
          RETURN CASE WHEN FOUND THEN 'updated' ELSE 'inquiry_not_found' END;
        END
        $$;


--
-- Name: slotera_platform_overview(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_platform_overview(p_actor_user_id uuid) RETURNS TABLE(workspaces_total integer, workspaces_active integer, workspaces_suspended integer, workspaces_essentials integer, workspaces_professional integer, workspaces_on_trial integer, signups_30d integer, bookings_30d integer, inquiries_unread integer, emails_pending integer, emails_failing integer, email_last_error text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
          SELECT
            (SELECT count(*) FROM public.workspaces)::integer,
            (SELECT count(*) FROM public.workspaces
               WHERE operational_status::text = 'active')::integer,
            (SELECT count(*) FROM public.workspaces
               WHERE operational_status::text = 'suspended')::integer,
            (SELECT count(*) FROM public.workspaces WHERE plan = 'essentials')::integer,
            (SELECT count(*) FROM public.workspaces WHERE plan = 'professional')::integer,
            (SELECT count(*) FROM public.workspaces
               WHERE paid_through IS NULL
                 AND trial_ends_at > statement_timestamp())::integer,
            (SELECT count(*) FROM public.workspaces
               WHERE created_at > statement_timestamp() - interval '30 days')::integer,
            (SELECT count(*) FROM public.bookings
               WHERE created_at > statement_timestamp() - interval '30 days')::integer,
            (SELECT count(*) FROM public.platform_inquiries WHERE read_at IS NULL)::integer,
            (SELECT count(*) FROM public.email_outbox WHERE sent_at IS NULL AND suppressed_at IS NULL)::integer,
            (SELECT count(*) FROM public.email_outbox
               WHERE sent_at IS NULL AND suppressed_at IS NULL AND last_error IS NOT NULL)::integer,
            (SELECT last_error FROM public.email_outbox
               WHERE sent_at IS NULL AND suppressed_at IS NULL AND last_error IS NOT NULL
               ORDER BY available_at DESC LIMIT 1)
          WHERE EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor_user_id AND platform_role::text = 'superadmin'
          )
        $$;


--
-- Name: slotera_platform_provision_workspace(uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_platform_provision_workspace(p_workspace_id uuid, p_owner_user_id uuid, p_membership_id uuid, p_audit_event_id uuid, p_actor_user_id uuid, p_name text, p_slug text, p_owner_first_names text, p_owner_last_name text, p_owner_email text, p_timezone text, p_currency text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor_user_id AND platform_role::text = 'superadmin'
          ) THEN
            RETURN 'actor_not_superadmin';
          END IF;
          RETURN public.slotera_workspace_create_with_owner(
            p_workspace_id, p_owner_user_id, p_membership_id, p_audit_event_id,
            p_actor_user_id, 'platform.workspace_provisioned', p_name, p_slug,
            p_owner_first_names, p_owner_last_name, p_owner_email, p_timezone, p_currency
          );
        END
        $$;


--
-- Name: slotera_platform_set_workspace_billing(uuid, uuid, text, text, timestamp with time zone, date, uuid, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_platform_set_workspace_billing(p_workspace_id uuid, p_actor_user_id uuid, p_plan text, p_billing_interval text, p_trial_ends_at timestamp with time zone, p_paid_through date, p_audit_event_id uuid, p_expected_version bigint) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE
          current public.workspaces%ROWTYPE;
        BEGIN
          
          IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = p_actor_user_id AND platform_role::text = 'superadmin'
          ) THEN
            RETURN 'actor_not_superadmin';
          END IF;

          IF p_plan NOT IN ('essentials', 'professional') THEN
            RETURN 'invalid_plan';
          END IF;
          IF p_billing_interval NOT IN ('monthly', 'yearly') THEN
            RETURN 'invalid_billing_interval';
          END IF;
          SELECT * INTO current FROM public.workspaces
          WHERE id = p_workspace_id FOR UPDATE;
          IF NOT FOUND THEN
            RETURN 'workspace_not_found';
          END IF;
          IF p_expected_version IS NULL OR current.billing_version <> p_expected_version THEN
            RETURN 'resource_stale';
          END IF;
          IF current.plan = p_plan
             AND current.billing_interval = p_billing_interval
             AND current.trial_ends_at = p_trial_ends_at
             AND current.paid_through IS NOT DISTINCT FROM p_paid_through THEN
            RETURN 'unchanged';
          END IF;
          UPDATE public.workspaces
          SET billing_version = billing_version + 1,
              plan = p_plan,
              plan_changed_at = CASE WHEN plan <> p_plan
                                     THEN statement_timestamp() ELSE plan_changed_at END,
              billing_interval = p_billing_interval,
              trial_ends_at = p_trial_ends_at,
              paid_through = p_paid_through,
              updated_at = statement_timestamp()
          WHERE id = p_workspace_id;
          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          ) VALUES (
            p_audit_event_id, p_workspace_id, p_actor_user_id,
            'platform.workspace_billing_changed', 'workspace', p_workspace_id,
            jsonb_build_object(
              'from', jsonb_build_object(
                'plan', current.plan, 'billingInterval', current.billing_interval,
                'trialEndsAt', current.trial_ends_at, 'paidThrough', current.paid_through
              ),
              'to', jsonb_build_object(
                'plan', p_plan, 'billingInterval', p_billing_interval,
                'trialEndsAt', p_trial_ends_at, 'paidThrough', p_paid_through
              )
            )
          );
          RETURN 'updated';
        END
        $$;


--
-- Name: slotera_platform_set_workspace_operational_status(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_platform_set_workspace_operational_status(p_workspace_id uuid, p_actor_user_id uuid, p_operational_status text, p_audit_event_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE
          current_status text;
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM public.users
            WHERE id = p_actor_user_id
              AND platform_role::text = 'superadmin'
          ) THEN
            RETURN 'actor_not_superadmin';
          END IF;

          IF p_operational_status NOT IN ('active', 'suspended') THEN
            RETURN 'invalid_status';
          END IF;

          PERFORM pg_advisory_xact_lock(hashtextextended('slotera:scheduling:'||p_workspace_id,0));
          SELECT operational_status::text
          INTO current_status
          FROM public.workspaces
          WHERE id = p_workspace_id
          FOR UPDATE;

          IF NOT FOUND THEN
            RETURN 'workspace_not_found';
          END IF;

          IF current_status = p_operational_status THEN
            RETURN 'unchanged';
          END IF;

          UPDATE public.workspaces
          SET operational_status = p_operational_status::public.workspace_operational_status,
              updated_at = statement_timestamp()
          WHERE id = p_workspace_id;

          IF p_operational_status = 'suspended' THEN
            DELETE FROM public.client_auth_sessions WHERE workspace_id=p_workspace_id;
            DELETE FROM public.client_login_tokens WHERE workspace_id=p_workspace_id;
            UPDATE public.auth_sessions
            SET revoked_at = statement_timestamp()
            WHERE active_workspace_id = p_workspace_id
              AND revoked_at IS NULL;
          END IF;

          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          )
          VALUES (
            p_audit_event_id,
            p_workspace_id,
            p_actor_user_id,
            CASE p_operational_status
              WHEN 'suspended' THEN 'platform.workspace_suspended'
              ELSE 'platform.workspace_reactivated'
            END,
            'workspace',
            p_workspace_id,
            '{}'::jsonb
          );

          RETURN 'updated';
        END
        $$;


--
-- Name: slotera_public_booking_access(bytea); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_public_booking_access(p_token_hash bytea) RETURNS TABLE(workspace_id uuid, booking_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
          SELECT token.workspace_id, token.booking_id
          FROM public.booking_access_tokens AS token
          JOIN public.workspaces AS workspace ON workspace.id = token.workspace_id
          WHERE token.token_hash = p_token_hash
            AND token.revoked_at IS NULL
            AND token.expires_at > statement_timestamp()
            AND workspace.operational_status::text = 'active'
        $$;


--
-- Name: slotera_public_create_inquiry(uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_public_create_inquiry(p_id uuid, p_name text, p_email text, p_company text, p_reason text, p_message text) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
          INSERT INTO public.platform_inquiries (id, name, email, company, reason, message)
          VALUES (p_id, p_name, lower(btrim(p_email)), NULLIF(btrim(p_company), ''),
                  p_reason, p_message)
          RETURNING true
        $$;


--
-- Name: slotera_public_resolve_workspace(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_public_resolve_workspace(p_slug text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
          SELECT workspace.id
          FROM public.workspaces AS workspace
          JOIN public.workspace_business_profiles AS profile
            ON profile.workspace_id = workspace.id
          WHERE workspace.slug = lower(btrim(p_slug))
            AND workspace.operational_status::text = 'active'
            AND profile.booking_page_enabled = true
        $$;


--
-- Name: slotera_rate_limit_consume(text, bytea, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_rate_limit_consume(p_scope text, p_key_hash bytea, p_limit integer, p_window_seconds integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE
          current_count integer;
        BEGIN
          IF p_scope = '' OR octet_length(p_key_hash) <> 32
             OR p_limit < 1 OR p_window_seconds < 1 THEN
            RETURN false;
          END IF;

          INSERT INTO public.request_rate_limits (
            scope, key_hash, window_started_at, request_count
          )
          VALUES (p_scope, p_key_hash, statement_timestamp(), 1)
          ON CONFLICT (scope, key_hash) DO UPDATE
          SET window_started_at = CASE
                WHEN public.request_rate_limits.window_started_at
                     <= statement_timestamp() - make_interval(secs => p_window_seconds)
                THEN statement_timestamp()
                ELSE public.request_rate_limits.window_started_at
              END,
              request_count = CASE
                WHEN public.request_rate_limits.window_started_at
                     <= statement_timestamp() - make_interval(secs => p_window_seconds)
                THEN 1
                ELSE public.request_rate_limits.request_count + 1
              END
          RETURNING request_count INTO current_count;

          RETURN current_count <= p_limit;
        END
        $$;


--
-- Name: slotera_series_due_extension(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_series_due_extension(p_horizon_days integer) RETURNS TABLE(workspace_id uuid, series_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
          SELECT series.workspace_id, series.id
          FROM public.session_series AS series
          WHERE series.horizon_through
                < (statement_timestamp() AT TIME ZONE series.timezone)::date + p_horizon_days
            AND (series.ends_on IS NULL OR series.horizon_through < series.ends_on)
          ORDER BY series.horizon_through
          LIMIT 500
        $$;


--
-- Name: slotera_workspace_create_with_owner(uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_workspace_create_with_owner(p_workspace_id uuid, p_owner_user_id uuid, p_membership_id uuid, p_audit_event_id uuid, p_actor_user_id uuid, p_audit_action text, p_name text, p_slug text, p_owner_first_names text, p_owner_last_name text, p_owner_email text, p_timezone text, p_currency text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE
          normalized_owner_email text := lower(btrim(p_owner_email));
        BEGIN
          IF EXISTS (SELECT 1 FROM public.reserved_workspace_slugs WHERE slug = p_slug) THEN
            RETURN 'workspace_slug_reserved';
          END IF;
          IF EXISTS (SELECT 1 FROM public.workspaces WHERE slug = p_slug) THEN
            RETURN 'workspace_slug_taken';
          END IF;
          IF EXISTS (SELECT 1 FROM public.users WHERE email = normalized_owner_email) THEN
            RETURN 'workspace_owner_email_taken';
          END IF;

          INSERT INTO public.workspaces (id, name, slug, currency, timezone)
          VALUES (p_workspace_id, p_name, p_slug, p_currency, p_timezone);
          INSERT INTO public.users (
            id, email, first_names, last_name, password_hash, platform_role
          ) VALUES (
            p_owner_user_id, normalized_owner_email, p_owner_first_names,
            p_owner_last_name, NULL, NULL
          );
          INSERT INTO public.workspace_memberships (id, workspace_id, user_id, role)
          VALUES (p_membership_id, p_workspace_id, p_owner_user_id, 'operator_admin');
          INSERT INTO public.workspace_business_profiles (
            workspace_id, display_name, bio, email, phone, address, booking_page_enabled
          ) VALUES (
            p_workspace_id, p_name, '', normalized_owner_email, '', '', true
          );
          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          ) VALUES (
            p_audit_event_id, p_workspace_id, p_actor_user_id,
            p_audit_action, 'workspace', p_workspace_id, '{}'::jsonb
          );
          RETURN 'created';
        END
        $$;


--
-- Name: slotera_workspace_purge_closed(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_workspace_purge_closed(p_after_days integer DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        DECLARE
          target uuid;
          purged integer := 0;
          member_ids uuid[];
        BEGIN
          FOR target IN
            SELECT id FROM public.workspaces
            WHERE closure_requested_at IS NOT NULL
              AND operational_status::text = 'suspended'
              AND closure_requested_at
                < statement_timestamp() - make_interval(days => GREATEST(p_after_days, 1))
            ORDER BY id
          LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended('slotera:scheduling:' || target::text, 0));
            PERFORM id FROM public.workspaces WHERE id = target
              AND closure_requested_at IS NOT NULL
              AND operational_status::text = 'suspended'
              AND closure_requested_at < statement_timestamp() - make_interval(days => GREATEST(p_after_days, 1))
              FOR UPDATE SKIP LOCKED;
            IF NOT FOUND THEN CONTINUE; END IF;
            SELECT coalesce(array_agg(user_id), '{}') INTO member_ids
            FROM public.workspace_memberships WHERE workspace_id = target;

            DELETE FROM public.email_outbox
            WHERE related_booking_id IN (
                SELECT id FROM public.bookings WHERE workspace_id = target
              );
            DELETE FROM public.session_command_idempotency WHERE workspace_id = target;
            DELETE FROM public.booking_command_idempotency WHERE workspace_id = target;
            DELETE FROM public.bookings WHERE workspace_id = target;
            DELETE FROM public.package_purchases WHERE workspace_id = target;
            DELETE FROM public.sessions WHERE workspace_id = target;
            DELETE FROM public.session_series WHERE workspace_id = target;
            DELETE FROM public.form_template_services WHERE workspace_id = target;
            DELETE FROM public.workspaces WHERE id = target;

            DELETE FROM public.users AS u
            WHERE u.id = ANY (member_ids)
              AND u.platform_role IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM public.workspace_memberships AS m WHERE m.user_id = u.id
              );
            purged := purged + 1;
          END LOOP;
          RETURN purged;
        END
        $$;


--
-- Name: slotera_workspace_request_closure(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slotera_workspace_request_closure(p_workspace_id uuid, p_actor_user_id uuid, p_audit_event_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_id = p_workspace_id
              AND user_id = p_actor_user_id
              AND role::text = 'operator_admin'
          ) THEN
            RETURN 'actor_not_operator';
          END IF;

          PERFORM pg_advisory_xact_lock(hashtextextended('slotera:scheduling:'||p_workspace_id,0));
          UPDATE public.workspaces
          SET closure_requested_at = statement_timestamp(),
              operational_status = 'suspended',
              updated_at = statement_timestamp()
          WHERE id = p_workspace_id AND closure_requested_at IS NULL;
          IF NOT FOUND THEN
            RETURN 'already_closing';
          END IF;

          DELETE FROM public.client_auth_sessions WHERE workspace_id=p_workspace_id;
          DELETE FROM public.client_login_tokens WHERE workspace_id=p_workspace_id;
          UPDATE public.auth_sessions
          SET revoked_at = statement_timestamp()
          WHERE active_workspace_id = p_workspace_id AND revoked_at IS NULL;

          INSERT INTO public.audit_events (
            id, workspace_id, actor_user_id, action, resource_type, resource_id, details
          )
          VALUES (
            p_audit_event_id, p_workspace_id, p_actor_user_id,
            'workspace.closure_requested', 'workspace', p_workspace_id, '{}'::jsonb
          );
          RETURN 'closing';
        END
        $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    actor_user_id uuid,
    action character varying(120) NOT NULL,
    resource_type character varying(80) NOT NULL,
    resource_id uuid,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.audit_events FORCE ROW LEVEL SECURITY;


--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    active_workspace_id uuid,
    token_hash bytea NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    csrf_token_hash bytea NOT NULL,
    CONSTRAINT ck_auth_sessions_ck_auth_sessions_token_hash_sha256 CHECK ((octet_length(token_hash) = 32)),
    CONSTRAINT ck_auth_sessions_csrf_token_hash_sha256 CHECK ((octet_length(csrf_token_hash) = 32)),
    CONSTRAINT ck_auth_sessions_expires_after_creation CHECK ((expires_at > created_at))
);


--
-- Name: availability_blackouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_blackouts (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    reason character varying(240),
    CONSTRAINT ck_availability_blackouts_ordered CHECK ((starts_at < ends_at))
);

ALTER TABLE ONLY public.availability_blackouts FORCE ROW LEVEL SECURITY;


--
-- Name: availability_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_policies (
    workspace_id uuid NOT NULL,
    slot_interval_min integer DEFAULT 30 NOT NULL,
    buffer_before_min integer DEFAULT 0 NOT NULL,
    buffer_after_min integer DEFAULT 0 NOT NULL,
    minimum_notice_min integer DEFAULT 1440 NOT NULL,
    maximum_advance_days integer DEFAULT 90 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_change_notice_hours integer DEFAULT 24 NOT NULL,
    CONSTRAINT ck_availability_policies_buffer_after CHECK (((buffer_after_min >= 0) AND (buffer_after_min <= 1440))),
    CONSTRAINT ck_availability_policies_buffer_before CHECK (((buffer_before_min >= 0) AND (buffer_before_min <= 1440))),
    CONSTRAINT ck_availability_policies_ck_availability_policies_custo_476f CHECK (((customer_change_notice_hours >= 0) AND (customer_change_notice_hours <= 720))),
    CONSTRAINT ck_availability_policies_maximum_advance CHECK (((maximum_advance_days >= 1) AND (maximum_advance_days <= 730))),
    CONSTRAINT ck_availability_policies_minimum_notice CHECK (((minimum_notice_min >= 0) AND (minimum_notice_min <= 525600))),
    CONSTRAINT ck_availability_policies_slot_interval CHECK (((slot_interval_min >= 5) AND (slot_interval_min <= 1440)))
);

ALTER TABLE ONLY public.availability_policies FORCE ROW LEVEL SECURITY;


--
-- Name: availability_windows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_windows (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_local time without time zone NOT NULL,
    end_local time without time zone NOT NULL,
    CONSTRAINT ck_availability_windows_day_of_week CHECK (((day_of_week >= 1) AND (day_of_week <= 7))),
    CONSTRAINT ck_availability_windows_ordered CHECK ((start_local < end_local))
);

ALTER TABLE ONLY public.availability_windows FORCE ROW LEVEL SECURITY;


--
-- Name: booking_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_access_tokens (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    token_hash bytea NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_booking_access_tokens_ck_booking_access_token_hash CHECK ((octet_length(token_hash) = 32))
);

ALTER TABLE ONLY public.booking_access_tokens FORCE ROW LEVEL SECURITY;


--
-- Name: booking_command_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_command_idempotency (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    actor_user_id uuid NOT NULL,
    idempotency_key character varying(255) NOT NULL,
    command character varying(64) NOT NULL,
    request_fingerprint character varying(64) NOT NULL,
    booking_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.booking_command_idempotency FORCE ROW LEVEL SECURITY;


--
-- Name: booking_form_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_form_responses (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    form_template_id uuid NOT NULL,
    form_name character varying(160) NOT NULL,
    answers jsonb NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.booking_form_responses FORCE ROW LEVEL SECURITY;


--
-- Name: booking_form_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_form_snapshots (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    form_template_id uuid NOT NULL,
    name character varying(160) NOT NULL,
    description character varying(1000) NOT NULL,
    fields jsonb NOT NULL,
    required_before_payment boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.booking_form_snapshots FORCE ROW LEVEL SECURITY;


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    session_id uuid NOT NULL,
    client_id uuid NOT NULL,
    status public.booking_status NOT NULL,
    payment_status public.payment_status NOT NULL,
    amount_cents integer NOT NULL,
    currency character varying(3) NOT NULL,
    notes character varying(2000),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    attendance public.booking_attendance,
    reference character varying(32) NOT NULL,
    payment_method character varying(16) NOT NULL,
    net_amount_cents integer NOT NULL,
    tax_amount_cents integer NOT NULL,
    tax_treatment character varying(16) NOT NULL,
    tax_rate_bps integer NOT NULL,
    tax_label character varying(40),
    tax_jurisdiction character varying(2),
    seller_tax_number character varying(80),
    billing_address jsonb DEFAULT '{}'::jsonb NOT NULL,
    payment_due_at timestamp with time zone,
    origin public.booking_origin DEFAULT 'operator'::public.booking_origin NOT NULL,
    confirmation_policy_snapshot public.confirmation_policy DEFAULT 'automatic'::public.confirmation_policy NOT NULL,
    approval_status public.booking_approval_status DEFAULT 'not_required'::public.booking_approval_status NOT NULL,
    payment_received_at timestamp with time zone,
    approved_at timestamp with time zone,
    declined_at timestamp with time zone,
    customer_first_name character varying(80) DEFAULT ''::character varying NOT NULL,
    customer_last_name character varying(80) DEFAULT ''::character varying NOT NULL,
    customer_email character varying(320) DEFAULT ''::character varying NOT NULL,
    customer_phone character varying(40),
    customer_company character varying(160),
    provider_terms_snapshot text DEFAULT ''::text NOT NULL,
    platform_terms_version character varying(80) DEFAULT ''::character varying NOT NULL,
    terms_accepted_at timestamp with time zone,
    manual_payment_instructions_snapshot text DEFAULT ''::text NOT NULL,
    customer_rescheduled_at timestamp with time zone,
    delivery_email_override character varying(320),
    language character varying(2) DEFAULT 'en'::character varying NOT NULL,
    CONSTRAINT bookings_language_check CHECK (((language)::text = ANY ((ARRAY['en'::character varying, 'tr'::character varying, 'de'::character varying])::text[]))),
    CONSTRAINT ck_bookings_amount_nonnegative CHECK ((amount_cents >= 0)),
    CONSTRAINT ck_bookings_ck_bookings_approval_policy CHECK ((((confirmation_policy_snapshot = 'automatic'::public.confirmation_policy) AND (approval_status = 'not_required'::public.booking_approval_status)) OR ((confirmation_policy_snapshot = 'operator_approval'::public.confirmation_policy) AND (approval_status <> 'not_required'::public.booking_approval_status)))),
    CONSTRAINT ck_bookings_ck_bookings_confirmation_gate CHECK (((status <> ALL (ARRAY['confirmed'::public.booking_status, 'completed'::public.booking_status, 'noshow'::public.booking_status])) OR ((payment_status = ANY (ARRAY['paid'::public.payment_status, 'free'::public.payment_status])) AND (approval_status = ANY (ARRAY['not_required'::public.booking_approval_status, 'approved'::public.booking_approval_status]))))),
    CONSTRAINT ck_bookings_ck_bookings_customer_email_normalized CHECK (((customer_email)::text = lower(btrim((customer_email)::text)))),
    CONSTRAINT ck_bookings_ck_bookings_declined_cancelled CHECK (((approval_status <> 'declined'::public.booking_approval_status) OR (status = 'cancelled'::public.booking_status))),
    CONSTRAINT ck_bookings_ck_bookings_financial_snapshot_nonnegative CHECK (((net_amount_cents >= 0) AND (tax_amount_cents >= 0) AND (amount_cents = (net_amount_cents + tax_amount_cents)))),
    CONSTRAINT ck_bookings_ck_bookings_payment_method CHECK (((payment_method)::text = ANY ((ARRAY['free'::character varying, 'manual'::character varying, 'package'::character varying])::text[]))),
    CONSTRAINT ck_bookings_ck_bookings_public_terms_evidence CHECK (((origin <> 'public'::public.booking_origin) OR (terms_accepted_at IS NOT NULL))),
    CONSTRAINT ck_bookings_ck_bookings_tax_treatment CHECK ((((tax_treatment)::text = ANY ((ARRAY['none'::character varying, 'fixed'::character varying])::text[])) AND ((tax_rate_bps >= 0) AND (tax_rate_bps <= 10000)))),
    CONSTRAINT ck_bookings_currency_iso_length CHECK ((char_length((currency)::text) = 3))
);

ALTER TABLE ONLY public.bookings FORCE ROW LEVEL SECURITY;


--
-- Name: calendar_feed_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_feed_tokens (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT ck_calendar_feed_tokens_ck_calendar_feed_token_hash CHECK ((octet_length(token_hash) = 32))
);

ALTER TABLE ONLY public.calendar_feed_tokens FORCE ROW LEVEL SECURITY;


--
-- Name: client_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_notes (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    client_id uuid NOT NULL,
    title character varying(160) NOT NULL,
    body character varying(20000) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.client_notes FORCE ROW LEVEL SECURITY;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(160) NOT NULL,
    email character varying(320) NOT NULL,
    phone character varying(40),
    company character varying(160),
    role character varying(160),
    timezone character varying(64),
    address character varying(500),
    vat_id character varying(80),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_clients_email_normalized CHECK (((email)::text = lower(btrim((email)::text))))
);

ALTER TABLE ONLY public.clients FORCE ROW LEVEL SECURITY;


--
-- Name: email_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_outbox (
    id uuid NOT NULL,
    kind character varying(80) NOT NULL,
    recipient_email character varying(320) NOT NULL,
    subject character varying(300) NOT NULL,
    text_body text NOT NULL,
    related_password_reset_token_id uuid,
    attempt_count integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    claimed_at timestamp with time zone,
    sent_at timestamp with time zone,
    suppressed_at timestamp with time zone,
    provider_message_id character varying(255),
    last_error character varying(1000),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    template_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    related_booking_id uuid,
    event_key text DEFAULT ''::text NOT NULL,
    CONSTRAINT ck_email_outbox_attempt_count_nonnegative CHECK ((attempt_count >= 0))
);


--
-- Name: form_template_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_template_services (
    workspace_id uuid NOT NULL,
    form_template_id uuid NOT NULL,
    service_id uuid NOT NULL
);

ALTER TABLE ONLY public.form_template_services FORCE ROW LEVEL SECURITY;


--
-- Name: form_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_templates (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(160) NOT NULL,
    description character varying(1000) DEFAULT ''::character varying NOT NULL,
    status public.form_status NOT NULL,
    fields jsonb NOT NULL,
    required_before_payment boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.form_templates FORCE ROW LEVEL SECURITY;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    recipient_user_id uuid NOT NULL,
    kind public.notification_kind NOT NULL,
    payload jsonb NOT NULL,
    resource_type character varying(80),
    resource_id uuid,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone
);

ALTER TABLE ONLY public.notifications FORCE ROW LEVEL SECURITY;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash bytea NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_password_reset_tokens_ck_password_reset_tokens_token_860e CHECK ((octet_length(token_hash) = 32))
);


--
-- Name: platform_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_inquiries (
    id uuid NOT NULL,
    name character varying(160) NOT NULL,
    email character varying(320) NOT NULL,
    company character varying(160),
    reason character varying(32) NOT NULL,
    message character varying(4000) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone
);


--
-- Name: public_booking_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_booking_idempotency (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    idempotency_key character varying(255) NOT NULL,
    request_fingerprint character varying(64) NOT NULL,
    booking_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.public_booking_idempotency FORCE ROW LEVEL SECURITY;


--
-- Name: request_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_rate_limits (
    scope character varying(64) NOT NULL,
    key_hash bytea NOT NULL,
    window_started_at timestamp with time zone NOT NULL,
    request_count integer NOT NULL,
    CONSTRAINT ck_request_rate_limits_key_hash_sha256 CHECK ((octet_length(key_hash) = 32)),
    CONSTRAINT ck_request_rate_limits_request_count_positive CHECK ((request_count > 0))
);


--
-- Name: reserved_workspace_slugs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reserved_workspace_slugs (
    slug character varying(80) NOT NULL,
    reason character varying(160) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_reserved_workspace_slugs_ck_reserved_workspace_slugs_7f64 CHECK (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))
);


--
-- Name: service_package_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_package_items (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    package_id uuid NOT NULL,
    service_id uuid NOT NULL,
    title character varying(160),
    description character varying(1000),
    "position" integer NOT NULL,
    CONSTRAINT service_package_items_position_check CHECK (("position" >= 0))
);

ALTER TABLE ONLY public.service_package_items FORCE ROW LEVEL SECURITY;


--
-- Name: service_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_packages (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(160) NOT NULL,
    description character varying(4000) NOT NULL,
    status character varying(8) NOT NULL,
    price_cents integer NOT NULL,
    notes character varying(4000),
    featured boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_packages_price_cents_check CHECK ((price_cents >= 0)),
    CONSTRAINT service_packages_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);

ALTER TABLE ONLY public.service_packages FORCE ROW LEVEL SECURITY;


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(160) NOT NULL,
    description character varying(4000) DEFAULT ''::character varying NOT NULL,
    duration_min integer NOT NULL,
    price_cents integer NOT NULL,
    capacity integer NOT NULL,
    location_type public.location_type NOT NULL,
    location character varying(240) NOT NULL,
    address jsonb,
    booking_mode public.service_booking_mode NOT NULL,
    cancellation_rule character varying(1000) DEFAULT ''::character varying NOT NULL,
    active boolean DEFAULT true NOT NULL,
    notes character varying(2000),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmation_policy public.confirmation_policy DEFAULT 'automatic'::public.confirmation_policy NOT NULL,
    meeting_url character varying(500),
    CONSTRAINT ck_services_capacity CHECK (((capacity >= 1) AND (capacity <= 10000))),
    CONSTRAINT ck_services_ck_services_meeting_url_https CHECK (((meeting_url)::text ~~ 'https://%'::text)),
    CONSTRAINT ck_services_duration CHECK (((duration_min >= 5) AND (duration_min <= 1440))),
    CONSTRAINT ck_services_price CHECK ((price_cents >= 0))
);

ALTER TABLE ONLY public.services FORCE ROW LEVEL SECURITY;


--
-- Name: session_action_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_action_items (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    session_id uuid,
    title character varying(160) NOT NULL,
    description character varying(1000),
    status public.session_action_item_status DEFAULT 'todo'::public.session_action_item_status NOT NULL,
    due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.session_action_items FORCE ROW LEVEL SECURITY;


--
-- Name: session_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_series (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    interval_weeks integer NOT NULL,
    weekdays jsonb NOT NULL,
    timezone character varying(64) NOT NULL,
    starts_on date NOT NULL,
    ends_on date,
    horizon_through date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_session_series_date_order CHECK (((starts_on <= ends_on) OR (ends_on IS NULL))),
    CONSTRAINT ck_session_series_interval_weeks CHECK (((interval_weeks >= 1) AND (interval_weeks <= 52)))
);

ALTER TABLE ONLY public.session_series FORCE ROW LEVEL SECURITY;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    series_id uuid,
    service_id uuid NOT NULL,
    calendar_owner_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    capacity integer NOT NULL,
    status public.session_status DEFAULT 'scheduled'::public.session_status NOT NULL,
    location_type public.location_type NOT NULL,
    location character varying(240) NOT NULL,
    address jsonb,
    notes character varying(2000),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    origin public.session_origin DEFAULT 'operator'::public.session_origin NOT NULL,
    CONSTRAINT ck_sessions_capacity CHECK (((capacity >= 1) AND (capacity <= 10000))),
    CONSTRAINT ck_sessions_ck_sessions_public_open_origin CHECK (((origin <> 'public_open'::public.session_origin) OR ((series_id IS NULL) AND (capacity = 1)))),
    CONSTRAINT ck_sessions_ordered CHECK ((start_at < end_at))
);

ALTER TABLE ONLY public.sessions FORCE ROW LEVEL SECURITY;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(320) NOT NULL,
    title character varying(32),
    first_names character varying(160) NOT NULL,
    last_name character varying(160) NOT NULL,
    password_hash character varying(255),
    platform_role public.platform_role,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    preferred_language character varying(2) DEFAULT 'en'::character varying NOT NULL,
    CONSTRAINT ck_users_ck_users_email_normalized CHECK (((email)::text = lower(btrim((email)::text)))),
    CONSTRAINT users_preferred_language_check CHECK (((preferred_language)::text = ANY ((ARRAY['en'::character varying, 'tr'::character varying, 'de'::character varying])::text[])))
);


--
-- Name: workspace_business_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_business_profiles (
    workspace_id uuid NOT NULL,
    display_name character varying(160) NOT NULL,
    bio character varying(4000) DEFAULT ''::character varying NOT NULL,
    email character varying(320) NOT NULL,
    phone character varying(40) DEFAULT ''::character varying NOT NULL,
    address character varying(500) DEFAULT ''::character varying NOT NULL,
    booking_page_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    onboarding_completed_at timestamp with time zone,
    notify_operator_new boolean DEFAULT true NOT NULL,
    notify_operator_cancelled boolean DEFAULT true NOT NULL,
    notify_operator_rescheduled boolean DEFAULT true NOT NULL,
    brand_accent character varying(7) DEFAULT '#3d5a3d'::character varying NOT NULL,
    brand_font character varying(5) DEFAULT 'serif'::character varying NOT NULL,
    CONSTRAINT ck_brand_accent CHECK (((brand_accent)::text ~ '^#[0-9a-fA-F]{6}$'::text)),
    CONSTRAINT ck_brand_font CHECK (((brand_font)::text = ANY ((ARRAY['serif'::character varying, 'sans'::character varying])::text[])))
);

ALTER TABLE ONLY public.workspace_business_profiles FORCE ROW LEVEL SECURITY;


--
-- Name: workspace_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_locations (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    label character varying(160) NOT NULL,
    street character varying(200) NOT NULL,
    street2 character varying(200),
    city character varying(120) NOT NULL,
    region character varying(120),
    postal_code character varying(32) NOT NULL,
    country character varying(2) NOT NULL,
    notes character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_workspace_locations_country_iso2 CHECK ((((country)::text = upper((country)::text)) AND ((country)::text ~ '^[A-Z]{2}$'::text)))
);

ALTER TABLE ONLY public.workspace_locations FORCE ROW LEVEL SECURITY;


--
-- Name: workspace_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_memberships (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.membership_role DEFAULT 'operator_admin'::public.membership_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.workspace_memberships FORCE ROW LEVEL SECURITY;


--
-- Name: workspace_payment_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_payment_settings (
    workspace_id uuid NOT NULL,
    manual_payment_enabled boolean DEFAULT true NOT NULL,
    manual_payment_instructions character varying(4000) DEFAULT ''::character varying NOT NULL,
    booking_terms_enabled boolean DEFAULT false NOT NULL,
    booking_terms_content character varying(10000) DEFAULT ''::character varying NOT NULL,
    tax_treatment character varying(16) DEFAULT 'none'::character varying NOT NULL,
    tax_rate_bps integer DEFAULT 0 NOT NULL,
    tax_label character varying(40) DEFAULT 'Tax'::character varying NOT NULL,
    tax_jurisdiction character varying(2),
    seller_tax_number character varying(80),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_workspace_payment_settings_tax_jurisdiction_iso2 CHECK (((tax_jurisdiction IS NULL) OR ((tax_jurisdiction)::text ~ '^[A-Z]{2}$'::text))),
    CONSTRAINT ck_workspace_payment_settings_tax_rate_bps CHECK (((tax_rate_bps >= 0) AND (tax_rate_bps <= 10000))),
    CONSTRAINT ck_workspace_payment_settings_tax_treatment CHECK (((tax_treatment)::text = ANY ((ARRAY['none'::character varying, 'fixed'::character varying])::text[]))),
    CONSTRAINT ck_workspace_payment_settings_tax_treatment_rate CHECK (((((tax_treatment)::text = 'none'::text) AND (tax_rate_bps = 0)) OR (((tax_treatment)::text = 'fixed'::text) AND (tax_rate_bps > 0))))
);

ALTER TABLE ONLY public.workspace_payment_settings FORCE ROW LEVEL SECURITY;


--
-- Name: workspace_slug_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_slug_history (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    slug character varying(80) NOT NULL,
    retired_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.workspace_slug_history FORCE ROW LEVEL SECURITY;


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    billing_version bigint DEFAULT 1 NOT NULL,
    id uuid NOT NULL,
    name character varying(160) NOT NULL,
    slug character varying(80) NOT NULL,
    currency character varying(3) DEFAULT 'GBP'::character varying NOT NULL,
    timezone character varying(64) DEFAULT 'Europe/Berlin'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    operational_status public.workspace_operational_status DEFAULT 'active'::public.workspace_operational_status NOT NULL,
    plan character varying(16) DEFAULT 'essentials'::character varying NOT NULL,
    plan_changed_at timestamp with time zone,
    billing_interval character varying(16) DEFAULT 'monthly'::character varying NOT NULL,
    trial_ends_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
    paid_through date,
    closure_requested_at timestamp with time zone,
    CONSTRAINT ck_workspaces_ck_workspaces_billing_interval CHECK (((billing_interval)::text = ANY ((ARRAY['monthly'::character varying, 'yearly'::character varying])::text[]))),
    CONSTRAINT ck_workspaces_ck_workspaces_currency_iso_length CHECK ((char_length((currency)::text) = 3)),
    CONSTRAINT ck_workspaces_ck_workspaces_currency_supported CHECK (((currency)::text = ANY ((ARRAY['GBP'::character varying, 'EUR'::character varying, 'USD'::character varying])::text[]))),
    CONSTRAINT ck_workspaces_ck_workspaces_plan CHECK (((plan)::text = ANY ((ARRAY['essentials'::character varying, 'professional'::character varying])::text[]))),
    CONSTRAINT ck_workspaces_ck_workspaces_slug_format CHECK (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))
);

ALTER TABLE ONLY public.workspaces FORCE ROW LEVEL SECURITY;


--
-- Name: booking_form_snapshots booking_form_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_form_snapshots
    ADD CONSTRAINT booking_form_snapshots_pkey PRIMARY KEY (id);


--
-- Name: booking_form_snapshots booking_form_snapshots_workspace_id_booking_id_form_templat_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_form_snapshots
    ADD CONSTRAINT booking_form_snapshots_workspace_id_booking_id_form_templat_key UNIQUE (workspace_id, booking_id, form_template_id);


--
-- Name: sessions ex_sessions_owner_time; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT ex_sessions_owner_time EXCLUDE USING gist (calendar_owner_id WITH =, tstzrange(start_at, end_at, '[)'::text) WITH &&) WHERE ((status <> 'cancelled'::public.session_status)) DEFERRABLE;


--
-- Name: audit_events pk_audit_events; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT pk_audit_events PRIMARY KEY (id);


--
-- Name: auth_sessions pk_auth_sessions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT pk_auth_sessions PRIMARY KEY (id);


--
-- Name: availability_blackouts pk_availability_blackouts; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blackouts
    ADD CONSTRAINT pk_availability_blackouts PRIMARY KEY (id);


--
-- Name: availability_policies pk_availability_policies; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_policies
    ADD CONSTRAINT pk_availability_policies PRIMARY KEY (workspace_id);


--
-- Name: availability_windows pk_availability_windows; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_windows
    ADD CONSTRAINT pk_availability_windows PRIMARY KEY (id);


--
-- Name: booking_access_tokens pk_booking_access_tokens; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_access_tokens
    ADD CONSTRAINT pk_booking_access_tokens PRIMARY KEY (id);


--
-- Name: booking_command_idempotency pk_booking_command_idempotency; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_command_idempotency
    ADD CONSTRAINT pk_booking_command_idempotency PRIMARY KEY (id);


--
-- Name: booking_form_responses pk_booking_form_responses; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_form_responses
    ADD CONSTRAINT pk_booking_form_responses PRIMARY KEY (id);


--
-- Name: bookings pk_bookings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT pk_bookings PRIMARY KEY (id);


--
-- Name: calendar_feed_tokens pk_calendar_feed_tokens; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_feed_tokens
    ADD CONSTRAINT pk_calendar_feed_tokens PRIMARY KEY (id);


--
-- Name: client_notes pk_client_notes; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_notes
    ADD CONSTRAINT pk_client_notes PRIMARY KEY (id);


--
-- Name: clients pk_clients; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT pk_clients PRIMARY KEY (id);


--
-- Name: email_outbox pk_email_outbox; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT pk_email_outbox PRIMARY KEY (id);


--
-- Name: form_template_services pk_form_template_services; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_template_services
    ADD CONSTRAINT pk_form_template_services PRIMARY KEY (workspace_id, form_template_id, service_id);


--
-- Name: form_templates pk_form_templates; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_templates
    ADD CONSTRAINT pk_form_templates PRIMARY KEY (id);


--
-- Name: notifications pk_notifications; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT pk_notifications PRIMARY KEY (id);


--
-- Name: password_reset_tokens pk_password_reset_tokens; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT pk_password_reset_tokens PRIMARY KEY (id);


--
-- Name: platform_inquiries pk_platform_inquiries; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_inquiries
    ADD CONSTRAINT pk_platform_inquiries PRIMARY KEY (id);


--
-- Name: public_booking_idempotency pk_public_booking_idempotency; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_booking_idempotency
    ADD CONSTRAINT pk_public_booking_idempotency PRIMARY KEY (id);


--
-- Name: request_rate_limits pk_request_rate_limits; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_rate_limits
    ADD CONSTRAINT pk_request_rate_limits PRIMARY KEY (scope, key_hash);


--
-- Name: reserved_workspace_slugs pk_reserved_workspace_slugs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserved_workspace_slugs
    ADD CONSTRAINT pk_reserved_workspace_slugs PRIMARY KEY (slug);


--
-- Name: services pk_services; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT pk_services PRIMARY KEY (id);


--
-- Name: session_action_items pk_session_action_items; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_action_items
    ADD CONSTRAINT pk_session_action_items PRIMARY KEY (id);


--
-- Name: session_series pk_session_series; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_series
    ADD CONSTRAINT pk_session_series PRIMARY KEY (id);


--
-- Name: sessions pk_sessions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT pk_sessions PRIMARY KEY (id);


--
-- Name: users pk_users; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT pk_users PRIMARY KEY (id);


--
-- Name: workspace_business_profiles pk_workspace_business_profiles; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_business_profiles
    ADD CONSTRAINT pk_workspace_business_profiles PRIMARY KEY (workspace_id);


--
-- Name: workspace_locations pk_workspace_locations; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_locations
    ADD CONSTRAINT pk_workspace_locations PRIMARY KEY (id);


--
-- Name: workspace_memberships pk_workspace_memberships; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT pk_workspace_memberships PRIMARY KEY (id);


--
-- Name: workspace_payment_settings pk_workspace_payment_settings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_payment_settings
    ADD CONSTRAINT pk_workspace_payment_settings PRIMARY KEY (workspace_id);


--
-- Name: workspace_slug_history pk_workspace_slug_history; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_slug_history
    ADD CONSTRAINT pk_workspace_slug_history PRIMARY KEY (id);


--
-- Name: workspaces pk_workspaces; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT pk_workspaces PRIMARY KEY (id);


--
-- Name: service_package_items service_package_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_items
    ADD CONSTRAINT service_package_items_pkey PRIMARY KEY (id);


--
-- Name: service_package_items service_package_items_workspace_id_package_id_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_items
    ADD CONSTRAINT service_package_items_workspace_id_package_id_position_key UNIQUE (workspace_id, package_id, "position");


--
-- Name: service_packages service_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_packages
    ADD CONSTRAINT service_packages_pkey PRIMARY KEY (id);


--
-- Name: service_packages service_packages_workspace_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_packages
    ADD CONSTRAINT service_packages_workspace_id_id_key UNIQUE (workspace_id, id);


--
-- Name: auth_sessions uq_auth_sessions_token_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT uq_auth_sessions_token_hash UNIQUE (token_hash);


--
-- Name: availability_windows uq_availability_windows_workspace_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_windows
    ADD CONSTRAINT uq_availability_windows_workspace_id UNIQUE (workspace_id, day_of_week, start_local, end_local);


--
-- Name: booking_access_tokens uq_booking_access_tokens_token_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_access_tokens
    ADD CONSTRAINT uq_booking_access_tokens_token_hash UNIQUE (token_hash);


--
-- Name: booking_command_idempotency uq_booking_command_idempotency_actor_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_command_idempotency
    ADD CONSTRAINT uq_booking_command_idempotency_actor_key UNIQUE (workspace_id, actor_user_id, idempotency_key);


--
-- Name: booking_form_responses uq_booking_form_response; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_form_responses
    ADD CONSTRAINT uq_booking_form_response UNIQUE (workspace_id, booking_id, form_template_id);


--
-- Name: bookings uq_bookings_workspace_id_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT uq_bookings_workspace_id_id UNIQUE (workspace_id, id);


--
-- Name: bookings uq_bookings_workspace_reference; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT uq_bookings_workspace_reference UNIQUE (workspace_id, reference);


--
-- Name: calendar_feed_tokens uq_calendar_feed_tokens_token_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_feed_tokens
    ADD CONSTRAINT uq_calendar_feed_tokens_token_hash UNIQUE (token_hash);


--
-- Name: clients uq_clients_workspace_id_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT uq_clients_workspace_id_email UNIQUE (workspace_id, email);


--
-- Name: clients uq_clients_workspace_id_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT uq_clients_workspace_id_id UNIQUE (workspace_id, id);


--
-- Name: email_outbox uq_email_outbox_booking_event; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT uq_email_outbox_booking_event UNIQUE (kind, related_booking_id, event_key);


--
-- Name: form_templates uq_form_templates_workspace_id_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_templates
    ADD CONSTRAINT uq_form_templates_workspace_id_id UNIQUE (workspace_id, id);


--
-- Name: notifications uq_notifications_resource_event; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT uq_notifications_resource_event UNIQUE (workspace_id, recipient_user_id, kind, resource_type, resource_id);


--
-- Name: password_reset_tokens uq_password_reset_tokens_token_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT uq_password_reset_tokens_token_hash UNIQUE (token_hash);


--
-- Name: public_booking_idempotency uq_public_booking_idempotency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_booking_idempotency
    ADD CONSTRAINT uq_public_booking_idempotency_key UNIQUE (workspace_id, idempotency_key);


--
-- Name: services uq_services_workspace_id_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT uq_services_workspace_id_id UNIQUE (workspace_id, id);


--
-- Name: session_series uq_session_series_workspace_id_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_series
    ADD CONSTRAINT uq_session_series_workspace_id_id UNIQUE (workspace_id, id);


--
-- Name: sessions uq_sessions_series_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT uq_sessions_series_id UNIQUE (series_id, start_at);


--
-- Name: sessions uq_sessions_workspace_id_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT uq_sessions_workspace_id_id UNIQUE (workspace_id, id);


--
-- Name: users uq_users_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_email UNIQUE (email);


--
-- Name: workspace_memberships uq_workspace_memberships_workspace_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT uq_workspace_memberships_workspace_id UNIQUE (workspace_id, user_id);


--
-- Name: workspace_slug_history uq_workspace_slug_history_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_slug_history
    ADD CONSTRAINT uq_workspace_slug_history_slug UNIQUE (slug);


--
-- Name: workspaces uq_workspaces_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT uq_workspaces_slug UNIQUE (slug);


--
-- Name: ix_audit_events_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_events_action ON public.audit_events USING btree (action);


--
-- Name: ix_audit_events_actor_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_events_actor_user_id ON public.audit_events USING btree (actor_user_id);


--
-- Name: ix_audit_events_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_events_occurred_at ON public.audit_events USING btree (occurred_at);


--
-- Name: ix_audit_events_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_events_workspace_id ON public.audit_events USING btree (workspace_id);


--
-- Name: ix_auth_sessions_active_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_sessions_active_workspace_id ON public.auth_sessions USING btree (active_workspace_id);


--
-- Name: ix_auth_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_sessions_expires_at ON public.auth_sessions USING btree (expires_at);


--
-- Name: ix_auth_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_sessions_user_id ON public.auth_sessions USING btree (user_id);


--
-- Name: ix_availability_blackouts_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_availability_blackouts_workspace_id ON public.availability_blackouts USING btree (workspace_id);


--
-- Name: ix_availability_windows_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_availability_windows_workspace_id ON public.availability_windows USING btree (workspace_id);


--
-- Name: ix_booking_access_tokens_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_booking_access_tokens_booking ON public.booking_access_tokens USING btree (workspace_id, booking_id);


--
-- Name: ix_booking_command_idempotency_actor_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_booking_command_idempotency_actor_user_id ON public.booking_command_idempotency USING btree (actor_user_id);


--
-- Name: ix_booking_command_idempotency_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_booking_command_idempotency_workspace_id ON public.booking_command_idempotency USING btree (workspace_id);


--
-- Name: ix_booking_form_responses_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_booking_form_responses_workspace_id ON public.booking_form_responses USING btree (workspace_id);


--
-- Name: ix_booking_form_snapshots_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_booking_form_snapshots_workspace_id ON public.booking_form_snapshots USING btree (workspace_id);


--
-- Name: ix_bookings_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_client_id ON public.bookings USING btree (client_id);


--
-- Name: ix_bookings_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_session_id ON public.bookings USING btree (session_id);


--
-- Name: ix_bookings_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_bookings_workspace_id ON public.bookings USING btree (workspace_id);


--
-- Name: ix_calendar_feed_tokens_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_calendar_feed_tokens_owner ON public.calendar_feed_tokens USING btree (workspace_id, user_id);


--
-- Name: ix_client_notes_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_client_notes_client_id ON public.client_notes USING btree (client_id);


--
-- Name: ix_client_notes_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_client_notes_workspace_id ON public.client_notes USING btree (workspace_id);


--
-- Name: ix_clients_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_clients_workspace_id ON public.clients USING btree (workspace_id);


--
-- Name: ix_clients_workspace_id_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_clients_workspace_id_name ON public.clients USING btree (workspace_id, name);


--
-- Name: ix_email_outbox_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_email_outbox_pending ON public.email_outbox USING btree (available_at, created_at) WHERE (sent_at IS NULL AND suppressed_at IS NULL AND attempt_count < 10);


--
-- Name: ix_form_templates_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_form_templates_workspace_id ON public.form_templates USING btree (workspace_id);


--
-- Name: ix_notifications_principal_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_principal_occurred_at ON public.notifications USING btree (workspace_id, recipient_user_id, occurred_at);


--
-- Name: ix_notifications_principal_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_principal_unread ON public.notifications USING btree (workspace_id, recipient_user_id) WHERE (read_at IS NULL);


--
-- Name: ix_password_reset_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_password_reset_tokens_expires_at ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: ix_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: ix_public_booking_idempotency_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_public_booking_idempotency_workspace_id ON public.public_booking_idempotency USING btree (workspace_id);


--
-- Name: ix_request_rate_limits_window_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_request_rate_limits_window_started_at ON public.request_rate_limits USING btree (window_started_at);


--
-- Name: ix_service_package_items_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_service_package_items_workspace_id ON public.service_package_items USING btree (workspace_id);


--
-- Name: ix_service_packages_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_service_packages_workspace_id ON public.service_packages USING btree (workspace_id);


--
-- Name: ix_services_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_services_workspace_id ON public.services USING btree (workspace_id);


--
-- Name: ix_session_action_items_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_session_action_items_session_id ON public.session_action_items USING btree (session_id);


--
-- Name: ix_session_action_items_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_session_action_items_workspace_id ON public.session_action_items USING btree (workspace_id);


--
-- Name: ix_session_series_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_session_series_workspace_id ON public.session_series USING btree (workspace_id);


--
-- Name: ix_sessions_series_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sessions_series_id ON public.sessions USING btree (series_id);


--
-- Name: ix_sessions_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sessions_service_id ON public.sessions USING btree (service_id);


--
-- Name: ix_sessions_start_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sessions_start_at ON public.sessions USING btree (start_at);


--
-- Name: ix_sessions_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sessions_workspace_id ON public.sessions USING btree (workspace_id);


--
-- Name: ix_workspace_locations_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_workspace_locations_workspace_id ON public.workspace_locations USING btree (workspace_id);


--
-- Name: ix_workspace_memberships_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_workspace_memberships_user_id ON public.workspace_memberships USING btree (user_id);


--
-- Name: ix_workspace_memberships_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_workspace_memberships_workspace_id ON public.workspace_memberships USING btree (workspace_id);


--
-- Name: ix_workspace_slug_history_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_workspace_slug_history_workspace_id ON public.workspace_slug_history USING btree (workspace_id);


--
-- Name: users activation_language; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER activation_language BEFORE UPDATE OF password_hash ON public.users FOR EACH ROW WHEN (((old.password_hash IS NULL) AND (new.password_hash IS NOT NULL))) EXECUTE FUNCTION public.slotera_activation_language();


--
-- Name: email_outbox email_snapshot_language; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_snapshot_language BEFORE INSERT ON public.email_outbox FOR EACH ROW EXECUTE FUNCTION public.slotera_email_snapshot_language();


--
-- Name: booking_form_snapshots booking_form_snapshots_workspace_id_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_form_snapshots
    ADD CONSTRAINT booking_form_snapshots_workspace_id_booking_id_fkey FOREIGN KEY (workspace_id, booking_id) REFERENCES public.bookings(workspace_id, id) ON DELETE CASCADE;


--
-- Name: booking_form_snapshots booking_form_snapshots_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_form_snapshots
    ADD CONSTRAINT booking_form_snapshots_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: audit_events fk_audit_events_actor_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT fk_audit_events_actor_user_id_users FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_events fk_audit_events_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT fk_audit_events_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: auth_sessions fk_auth_sessions_active_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT fk_auth_sessions_active_workspace_id_workspaces FOREIGN KEY (active_workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: auth_sessions fk_auth_sessions_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT fk_auth_sessions_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: availability_blackouts fk_availability_blackouts_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blackouts
    ADD CONSTRAINT fk_availability_blackouts_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: availability_policies fk_availability_policies_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_policies
    ADD CONSTRAINT fk_availability_policies_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: availability_windows fk_availability_windows_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_windows
    ADD CONSTRAINT fk_availability_windows_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: booking_access_tokens fk_booking_access_tokens_workspace_id_bookings; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_access_tokens
    ADD CONSTRAINT fk_booking_access_tokens_workspace_id_bookings FOREIGN KEY (workspace_id, booking_id) REFERENCES public.bookings(workspace_id, id) ON DELETE CASCADE;


--
-- Name: booking_access_tokens fk_booking_access_tokens_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_access_tokens
    ADD CONSTRAINT fk_booking_access_tokens_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: booking_command_idempotency fk_booking_command_idempotency_actor_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_command_idempotency
    ADD CONSTRAINT fk_booking_command_idempotency_actor_user_id_users FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: booking_command_idempotency fk_booking_command_idempotency_workspace_id_bookings; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_command_idempotency
    ADD CONSTRAINT fk_booking_command_idempotency_workspace_id_bookings FOREIGN KEY (workspace_id, booking_id) REFERENCES public.bookings(workspace_id, id) ON DELETE CASCADE;


--
-- Name: booking_command_idempotency fk_booking_command_idempotency_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_command_idempotency
    ADD CONSTRAINT fk_booking_command_idempotency_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: booking_form_responses fk_booking_form_responses_workspace_id_bookings; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_form_responses
    ADD CONSTRAINT fk_booking_form_responses_workspace_id_bookings FOREIGN KEY (workspace_id, booking_id) REFERENCES public.bookings(workspace_id, id) ON DELETE CASCADE;


--
-- Name: booking_form_responses fk_booking_form_responses_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_form_responses
    ADD CONSTRAINT fk_booking_form_responses_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: bookings fk_bookings_workspace_id_clients; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT fk_bookings_workspace_id_clients FOREIGN KEY (workspace_id, client_id) REFERENCES public.clients(workspace_id, id) ON DELETE RESTRICT;


--
-- Name: bookings fk_bookings_workspace_id_sessions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT fk_bookings_workspace_id_sessions FOREIGN KEY (workspace_id, session_id) REFERENCES public.sessions(workspace_id, id) ON DELETE RESTRICT;


--
-- Name: bookings fk_bookings_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT fk_bookings_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: calendar_feed_tokens fk_calendar_feed_tokens_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_feed_tokens
    ADD CONSTRAINT fk_calendar_feed_tokens_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_feed_tokens fk_calendar_feed_tokens_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_feed_tokens
    ADD CONSTRAINT fk_calendar_feed_tokens_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: client_notes fk_client_notes_workspace_id_clients; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_notes
    ADD CONSTRAINT fk_client_notes_workspace_id_clients FOREIGN KEY (workspace_id, client_id) REFERENCES public.clients(workspace_id, id) ON DELETE CASCADE;


--
-- Name: client_notes fk_client_notes_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_notes
    ADD CONSTRAINT fk_client_notes_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: clients fk_clients_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT fk_clients_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: email_outbox fk_email_outbox_related_booking_id_bookings; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT fk_email_outbox_related_booking_id_bookings FOREIGN KEY (related_booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: email_outbox fk_email_outbox_related_password_reset_token_id_passwor_fe4a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT fk_email_outbox_related_password_reset_token_id_passwor_fe4a FOREIGN KEY (related_password_reset_token_id) REFERENCES public.password_reset_tokens(id) ON DELETE SET NULL;


--
-- Name: form_template_services fk_form_template_services_workspace_id_form_templates; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_template_services
    ADD CONSTRAINT fk_form_template_services_workspace_id_form_templates FOREIGN KEY (workspace_id, form_template_id) REFERENCES public.form_templates(workspace_id, id) ON DELETE CASCADE;


--
-- Name: form_template_services fk_form_template_services_workspace_id_services; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_template_services
    ADD CONSTRAINT fk_form_template_services_workspace_id_services FOREIGN KEY (workspace_id, service_id) REFERENCES public.services(workspace_id, id) ON DELETE RESTRICT;


--
-- Name: form_template_services fk_form_template_services_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_template_services
    ADD CONSTRAINT fk_form_template_services_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: form_templates fk_form_templates_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_templates
    ADD CONSTRAINT fk_form_templates_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: notifications fk_notifications_workspace_id_workspace_memberships; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notifications_workspace_id_workspace_memberships FOREIGN KEY (workspace_id, recipient_user_id) REFERENCES public.workspace_memberships(workspace_id, user_id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens fk_password_reset_tokens_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT fk_password_reset_tokens_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: public_booking_idempotency fk_public_booking_idempotency_workspace_id_bookings; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_booking_idempotency
    ADD CONSTRAINT fk_public_booking_idempotency_workspace_id_bookings FOREIGN KEY (workspace_id, booking_id) REFERENCES public.bookings(workspace_id, id) ON DELETE CASCADE;


--
-- Name: public_booking_idempotency fk_public_booking_idempotency_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_booking_idempotency
    ADD CONSTRAINT fk_public_booking_idempotency_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: services fk_services_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT fk_services_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: session_action_items fk_session_action_items_workspace_id_sessions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_action_items
    ADD CONSTRAINT fk_session_action_items_workspace_id_sessions FOREIGN KEY (workspace_id, session_id) REFERENCES public.sessions(workspace_id, id) ON DELETE CASCADE;


--
-- Name: session_action_items fk_session_action_items_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_action_items
    ADD CONSTRAINT fk_session_action_items_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: session_series fk_session_series_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_series
    ADD CONSTRAINT fk_session_series_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: sessions fk_sessions_workspace_id_services; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT fk_sessions_workspace_id_services FOREIGN KEY (workspace_id, service_id) REFERENCES public.services(workspace_id, id) ON DELETE RESTRICT;


--
-- Name: sessions fk_sessions_workspace_id_session_series; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT fk_sessions_workspace_id_session_series FOREIGN KEY (workspace_id, series_id) REFERENCES public.session_series(workspace_id, id) ON DELETE RESTRICT;


--
-- Name: sessions fk_sessions_workspace_id_workspace_memberships; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT fk_sessions_workspace_id_workspace_memberships FOREIGN KEY (workspace_id, calendar_owner_id) REFERENCES public.workspace_memberships(workspace_id, user_id) ON DELETE RESTRICT;


--
-- Name: sessions fk_sessions_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT fk_sessions_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_business_profiles fk_workspace_business_profiles_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_business_profiles
    ADD CONSTRAINT fk_workspace_business_profiles_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_locations fk_workspace_locations_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_locations
    ADD CONSTRAINT fk_workspace_locations_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_memberships fk_workspace_memberships_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT fk_workspace_memberships_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_memberships fk_workspace_memberships_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT fk_workspace_memberships_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_payment_settings fk_workspace_payment_settings_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_payment_settings
    ADD CONSTRAINT fk_workspace_payment_settings_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_slug_history fk_workspace_slug_history_workspace_id_workspaces; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_slug_history
    ADD CONSTRAINT fk_workspace_slug_history_workspace_id_workspaces FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: service_package_items service_package_items_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_items
    ADD CONSTRAINT service_package_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: service_package_items service_package_items_workspace_id_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_items
    ADD CONSTRAINT service_package_items_workspace_id_package_id_fkey FOREIGN KEY (workspace_id, package_id) REFERENCES public.service_packages(workspace_id, id) ON DELETE CASCADE;


--
-- Name: service_package_items service_package_items_workspace_id_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_package_items
    ADD CONSTRAINT service_package_items_workspace_id_service_id_fkey FOREIGN KEY (workspace_id, service_id) REFERENCES public.services(workspace_id, id) ON DELETE RESTRICT;


--
-- Name: service_packages service_packages_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_packages
    ADD CONSTRAINT service_packages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_events audit_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_events_insert ON public.audit_events FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: audit_events audit_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_events_select ON public.audit_events FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: availability_blackouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.availability_blackouts ENABLE ROW LEVEL SECURITY;

--
-- Name: availability_blackouts availability_blackouts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_blackouts_delete ON public.availability_blackouts FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: availability_blackouts availability_blackouts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_blackouts_insert ON public.availability_blackouts FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: availability_blackouts availability_blackouts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_blackouts_select ON public.availability_blackouts FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: availability_blackouts availability_blackouts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_blackouts_update ON public.availability_blackouts FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: availability_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.availability_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: availability_policies availability_policies_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_policies_delete ON public.availability_policies FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: availability_policies availability_policies_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_policies_insert ON public.availability_policies FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: availability_policies availability_policies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_policies_select ON public.availability_policies FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: availability_policies availability_policies_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_policies_update ON public.availability_policies FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: availability_windows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.availability_windows ENABLE ROW LEVEL SECURITY;

--
-- Name: availability_windows availability_windows_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_windows_delete ON public.availability_windows FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: availability_windows availability_windows_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_windows_insert ON public.availability_windows FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: availability_windows availability_windows_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_windows_select ON public.availability_windows FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: availability_windows availability_windows_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY availability_windows_update ON public.availability_windows FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: booking_access_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_access_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_access_tokens booking_access_tokens_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_access_tokens_delete ON public.booking_access_tokens FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: booking_access_tokens booking_access_tokens_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_access_tokens_insert ON public.booking_access_tokens FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: booking_access_tokens booking_access_tokens_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_access_tokens_select ON public.booking_access_tokens FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: booking_access_tokens booking_access_tokens_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_access_tokens_update ON public.booking_access_tokens FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: booking_command_idempotency; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_command_idempotency ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_command_idempotency booking_command_idempotency_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_command_idempotency_insert ON public.booking_command_idempotency FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: booking_command_idempotency booking_command_idempotency_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_command_idempotency_select ON public.booking_command_idempotency FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: booking_form_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_form_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_form_responses booking_form_responses_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_form_responses_delete ON public.booking_form_responses FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: booking_form_responses booking_form_responses_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_form_responses_insert ON public.booking_form_responses FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: booking_form_responses booking_form_responses_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_form_responses_select ON public.booking_form_responses FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: booking_form_responses booking_form_responses_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_form_responses_update ON public.booking_form_responses FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: booking_form_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_form_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_form_snapshots booking_form_snapshots_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_form_snapshots_tenant ON public.booking_form_snapshots TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings bookings_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_delete ON public.bookings FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: bookings bookings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_insert ON public.bookings FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: bookings bookings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_select ON public.bookings FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: bookings bookings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_update ON public.bookings FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: calendar_feed_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_feed_tokens calendar_feed_tokens_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_feed_tokens_delete ON public.calendar_feed_tokens FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: calendar_feed_tokens calendar_feed_tokens_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_feed_tokens_insert ON public.calendar_feed_tokens FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: calendar_feed_tokens calendar_feed_tokens_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_feed_tokens_select ON public.calendar_feed_tokens FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: calendar_feed_tokens calendar_feed_tokens_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_feed_tokens_update ON public.calendar_feed_tokens FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: client_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: client_notes client_notes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_notes_delete ON public.client_notes FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: client_notes client_notes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_notes_insert ON public.client_notes FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: client_notes client_notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_notes_select ON public.client_notes FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: client_notes client_notes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_notes_update ON public.client_notes FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: clients clients_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clients_delete ON public.clients FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: clients clients_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clients_insert ON public.clients FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: clients clients_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clients_select ON public.clients FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: clients clients_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clients_update ON public.clients FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: form_template_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_template_services ENABLE ROW LEVEL SECURITY;

--
-- Name: form_template_services form_template_services_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_template_services_delete ON public.form_template_services FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: form_template_services form_template_services_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_template_services_insert ON public.form_template_services FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: form_template_services form_template_services_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_template_services_select ON public.form_template_services FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: form_template_services form_template_services_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_template_services_update ON public.form_template_services FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: form_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: form_templates form_templates_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_templates_delete ON public.form_templates FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: form_templates form_templates_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_templates_insert ON public.form_templates FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: form_templates form_templates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_templates_select ON public.form_templates FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: form_templates form_templates_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_templates_update ON public.form_templates FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select ON public.notifications FOR SELECT TO slotera_app USING (((workspace_id = public.slotera_current_workspace_id()) AND (recipient_user_id = public.slotera_current_user_id())));


--
-- Name: notifications notifications_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO slotera_app USING (((workspace_id = public.slotera_current_workspace_id()) AND (recipient_user_id = public.slotera_current_user_id()))) WITH CHECK (((workspace_id = public.slotera_current_workspace_id()) AND (recipient_user_id = public.slotera_current_user_id())));


--
-- Name: public_booking_idempotency; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.public_booking_idempotency ENABLE ROW LEVEL SECURITY;

--
-- Name: public_booking_idempotency public_booking_idempotency_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_booking_idempotency_delete ON public.public_booking_idempotency FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: public_booking_idempotency public_booking_idempotency_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_booking_idempotency_insert ON public.public_booking_idempotency FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: public_booking_idempotency public_booking_idempotency_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_booking_idempotency_select ON public.public_booking_idempotency FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: public_booking_idempotency public_booking_idempotency_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_booking_idempotency_update ON public.public_booking_idempotency FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: service_package_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_package_items ENABLE ROW LEVEL SECURITY;

--
-- Name: service_package_items service_package_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_package_items_tenant ON public.service_package_items TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: service_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: service_packages service_packages_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_packages_tenant ON public.service_packages TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: services services_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_delete ON public.services FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: services services_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_insert ON public.services FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: services services_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_select ON public.services FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: services services_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_update ON public.services FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: session_action_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_action_items ENABLE ROW LEVEL SECURITY;

--
-- Name: session_action_items session_action_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_action_items_delete ON public.session_action_items FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: session_action_items session_action_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_action_items_insert ON public.session_action_items FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: session_action_items session_action_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_action_items_select ON public.session_action_items FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: session_action_items session_action_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_action_items_update ON public.session_action_items FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: session_series; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_series ENABLE ROW LEVEL SECURITY;

--
-- Name: session_series session_series_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_series_delete ON public.session_series FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: session_series session_series_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_series_insert ON public.session_series FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: session_series session_series_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_series_select ON public.session_series FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: session_series session_series_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_series_update ON public.session_series FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions sessions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_delete ON public.sessions FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: sessions sessions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_insert ON public.sessions FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: sessions sessions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_select ON public.sessions FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: sessions sessions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_update ON public.sessions FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_business_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_business_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_business_profiles workspace_business_profiles_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_business_profiles_delete ON public.workspace_business_profiles FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_business_profiles workspace_business_profiles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_business_profiles_insert ON public.workspace_business_profiles FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_business_profiles workspace_business_profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_business_profiles_select ON public.workspace_business_profiles FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_business_profiles workspace_business_profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_business_profiles_update ON public.workspace_business_profiles FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_locations workspace_locations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_locations_delete ON public.workspace_locations FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_locations workspace_locations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_locations_insert ON public.workspace_locations FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_locations workspace_locations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_locations_select ON public.workspace_locations FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_locations workspace_locations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_locations_update ON public.workspace_locations FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_memberships workspace_memberships_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memberships_delete ON public.workspace_memberships FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_memberships workspace_memberships_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memberships_insert ON public.workspace_memberships FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_memberships workspace_memberships_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memberships_select ON public.workspace_memberships FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_memberships workspace_memberships_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memberships_update ON public.workspace_memberships FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_payment_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_payment_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_payment_settings workspace_payment_settings_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_payment_settings_delete ON public.workspace_payment_settings FOR DELETE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_payment_settings workspace_payment_settings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_payment_settings_insert ON public.workspace_payment_settings FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_payment_settings workspace_payment_settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_payment_settings_select ON public.workspace_payment_settings FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_payment_settings workspace_payment_settings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_payment_settings_update ON public.workspace_payment_settings FOR UPDATE TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_slug_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_slug_history ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_slug_history workspace_slug_history_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_slug_history_insert ON public.workspace_slug_history FOR INSERT TO slotera_app WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspace_slug_history workspace_slug_history_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_slug_history_select ON public.workspace_slug_history FOR SELECT TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id()));


--
-- Name: workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: workspaces workspaces_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_insert ON public.workspaces FOR INSERT TO slotera_app WITH CHECK ((id = public.slotera_current_workspace_id()));


--
-- Name: workspaces workspaces_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_select ON public.workspaces FOR SELECT TO slotera_app USING ((id = public.slotera_current_workspace_id()));


--
-- Name: workspaces workspaces_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_update ON public.workspaces FOR UPDATE TO slotera_app USING ((id = public.slotera_current_workspace_id())) WITH CHECK ((id = public.slotera_current_workspace_id()));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO slotera_app;


--
-- Name: FUNCTION slotera_activation_language(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_activation_language() FROM PUBLIC;


--
-- Name: FUNCTION slotera_auth_change_password(p_session_token_hash bytea, p_password_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_auth_change_password(p_session_token_hash bytea, p_password_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_auth_change_password(p_session_token_hash bytea, p_password_hash text) TO slotera_app;


--
-- Name: FUNCTION slotera_auth_consume_password_reset(p_token_hash bytea, p_password_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_auth_consume_password_reset(p_token_hash bytea, p_password_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_auth_consume_password_reset(p_token_hash bytea, p_password_hash text) TO slotera_app;


--
-- Name: FUNCTION slotera_auth_create_session(p_session_id uuid, p_user_id uuid, p_workspace_id uuid, p_token_hash bytea, p_csrf_token_hash bytea, p_expires_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_auth_create_session(p_session_id uuid, p_user_id uuid, p_workspace_id uuid, p_token_hash bytea, p_csrf_token_hash bytea, p_expires_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_auth_create_session(p_session_id uuid, p_user_id uuid, p_workspace_id uuid, p_token_hash bytea, p_csrf_token_hash bytea, p_expires_at timestamp with time zone) TO slotera_app;


--
-- Name: FUNCTION slotera_auth_login_identity(p_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_auth_login_identity(p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_auth_login_identity(p_email text) TO slotera_app;


--
-- Name: FUNCTION slotera_auth_maintenance(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_auth_maintenance() FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_auth_maintenance() TO slotera_app;


--
-- Name: FUNCTION slotera_auth_preferences(p_token_hash bytea, p_language text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_auth_preferences(p_token_hash bytea, p_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_auth_preferences(p_token_hash bytea, p_language text) TO slotera_app;


--
-- Name: FUNCTION slotera_auth_request_password_reset(p_token_id uuid, p_outbox_id uuid, p_email text, p_token_hash bytea, p_expires_at timestamp with time zone, p_reset_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_auth_request_password_reset(p_token_id uuid, p_outbox_id uuid, p_email text, p_token_hash bytea, p_expires_at timestamp with time zone, p_reset_url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_auth_request_password_reset(p_token_id uuid, p_outbox_id uuid, p_email text, p_token_hash bytea, p_expires_at timestamp with time zone, p_reset_url text) TO slotera_app;


--
-- Name: FUNCTION slotera_auth_revoke_session(p_token_hash bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_auth_revoke_session(p_token_hash bytea) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_auth_revoke_session(p_token_hash bytea) TO slotera_app;


--
-- Name: FUNCTION slotera_auth_self_signup(p_workspace_id uuid, p_owner_user_id uuid, p_membership_id uuid, p_audit_event_id uuid, p_name text, p_slug text, p_owner_first_names text, p_owner_last_name text, p_owner_email text, p_timezone text, p_currency text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_auth_self_signup(p_workspace_id uuid, p_owner_user_id uuid, p_membership_id uuid, p_audit_event_id uuid, p_name text, p_slug text, p_owner_first_names text, p_owner_last_name text, p_owner_email text, p_timezone text, p_currency text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_auth_self_signup(p_workspace_id uuid, p_owner_user_id uuid, p_membership_id uuid, p_audit_event_id uuid, p_name text, p_slug text, p_owner_first_names text, p_owner_last_name text, p_owner_email text, p_timezone text, p_currency text) TO slotera_app;


--
-- Name: FUNCTION slotera_auth_session(p_token_hash bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_auth_session(p_token_hash bytea) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_auth_session(p_token_hash bytea) TO slotera_app;


--
-- Name: FUNCTION slotera_auth_slug_available(p_slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_auth_slug_available(p_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_auth_slug_available(p_slug text) TO slotera_app;


--
-- Name: FUNCTION slotera_booking_due_reminders(p_within interval); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_booking_due_reminders(p_within interval) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_booking_due_reminders(p_within interval) TO slotera_app;


--
-- Name: FUNCTION slotera_booking_emit_event(p_booking_id uuid, p_event text, p_manage_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_booking_emit_event(p_booking_id uuid, p_event text, p_manage_url text, p_event_key text, p_notify_operator boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_booking_emit_event(p_booking_id uuid, p_event text, p_manage_url text, p_event_key text, p_notify_operator boolean) TO slotera_app;


--
-- Name: FUNCTION slotera_booking_notify_client_moved(p_booking_id uuid, p_manage_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_booking_notify_client_moved(p_booking_id uuid, p_manage_url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_booking_notify_client_moved(p_booking_id uuid, p_manage_url text) TO slotera_app;


--
-- Name: FUNCTION slotera_booking_notify_operator(p_booking_id uuid, p_event text, p_admin_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_booking_notify_operator(p_booking_id uuid, p_event text, p_admin_url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_booking_notify_operator(p_booking_id uuid, p_event text, p_admin_url text) TO slotera_app;


--
-- Name: FUNCTION slotera_calendar_feed_resolve(p_token_hash bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_calendar_feed_resolve(p_token_hash bytea) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_calendar_feed_resolve(p_token_hash bytea) TO slotera_app;


--
-- Name: FUNCTION slotera_client_erase_outbox(p_client_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_client_erase_outbox(p_client_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_client_erase_outbox(p_client_id uuid) TO slotera_app;


--
-- Name: FUNCTION slotera_current_user_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_current_user_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_current_user_id() TO slotera_app;


--
-- Name: FUNCTION slotera_current_workspace_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_current_workspace_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_current_workspace_id() TO slotera_app;


--
-- Name: FUNCTION slotera_email_claim(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_email_claim() FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_email_claim() TO slotera_app;


--
-- Name: FUNCTION slotera_email_mark_failed(p_id uuid, p_error text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_email_mark_failed(p_id uuid, p_error text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_email_mark_failed(p_id uuid, p_error text) TO slotera_app;


--
-- Name: FUNCTION slotera_email_mark_sent(p_id uuid, p_provider_message_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_email_mark_sent(p_id uuid, p_provider_message_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_email_mark_sent(p_id uuid, p_provider_message_id text) TO slotera_app;


--
-- Name: FUNCTION slotera_email_snapshot_language(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_email_snapshot_language() FROM PUBLIC;


--
-- Name: FUNCTION slotera_platform_cancel_workspace_closure(p_workspace_id uuid, p_actor_user_id uuid, p_audit_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_platform_cancel_workspace_closure(p_workspace_id uuid, p_actor_user_id uuid, p_audit_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_platform_cancel_workspace_closure(p_workspace_id uuid, p_actor_user_id uuid, p_audit_event_id uuid) TO slotera_app;


--
-- Name: FUNCTION slotera_platform_get_workspace(p_workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_platform_get_workspace(p_workspace_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_platform_get_workspace(p_workspace_id uuid) TO slotera_app;


--
-- Name: FUNCTION slotera_platform_list_inquiries(p_actor_user_id uuid, p_limit integer, p_offset integer, p_search text, p_reason text, p_read text, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_platform_list_inquiries(p_actor_user_id uuid, p_limit integer, p_offset integer, p_search text, p_reason text, p_read text, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_platform_list_inquiries(p_actor_user_id uuid, p_limit integer, p_offset integer, p_search text, p_reason text, p_read text, p_id uuid) TO slotera_app;


--
-- Name: FUNCTION slotera_platform_list_workspaces(p_limit integer, p_offset integer, p_search text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_platform_list_workspaces(p_limit integer, p_offset integer, p_search text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_platform_list_workspaces(p_limit integer, p_offset integer, p_search text) TO slotera_app;


--
-- Name: FUNCTION slotera_platform_mark_inquiry_read(p_actor_user_id uuid, p_inquiry_id uuid, p_read boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_platform_mark_inquiry_read(p_actor_user_id uuid, p_inquiry_id uuid, p_read boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_platform_mark_inquiry_read(p_actor_user_id uuid, p_inquiry_id uuid, p_read boolean) TO slotera_app;


--
-- Name: FUNCTION slotera_platform_overview(p_actor_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_platform_overview(p_actor_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_platform_overview(p_actor_user_id uuid) TO slotera_app;


--
-- Name: FUNCTION slotera_platform_provision_workspace(p_workspace_id uuid, p_owner_user_id uuid, p_membership_id uuid, p_audit_event_id uuid, p_actor_user_id uuid, p_name text, p_slug text, p_owner_first_names text, p_owner_last_name text, p_owner_email text, p_timezone text, p_currency text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_platform_provision_workspace(p_workspace_id uuid, p_owner_user_id uuid, p_membership_id uuid, p_audit_event_id uuid, p_actor_user_id uuid, p_name text, p_slug text, p_owner_first_names text, p_owner_last_name text, p_owner_email text, p_timezone text, p_currency text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_platform_provision_workspace(p_workspace_id uuid, p_owner_user_id uuid, p_membership_id uuid, p_audit_event_id uuid, p_actor_user_id uuid, p_name text, p_slug text, p_owner_first_names text, p_owner_last_name text, p_owner_email text, p_timezone text, p_currency text) TO slotera_app;


--
-- Name: FUNCTION slotera_platform_set_workspace_billing(p_workspace_id uuid, p_actor_user_id uuid, p_plan text, p_billing_interval text, p_trial_ends_at timestamp with time zone, p_paid_through date, p_audit_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_platform_set_workspace_billing(p_workspace_id uuid, p_actor_user_id uuid, p_plan text, p_billing_interval text, p_trial_ends_at timestamp with time zone, p_paid_through date, p_audit_event_id uuid, p_expected_version bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_platform_set_workspace_billing(p_workspace_id uuid, p_actor_user_id uuid, p_plan text, p_billing_interval text, p_trial_ends_at timestamp with time zone, p_paid_through date, p_audit_event_id uuid, p_expected_version bigint) TO slotera_app;


--
-- Name: FUNCTION slotera_platform_set_workspace_operational_status(p_workspace_id uuid, p_actor_user_id uuid, p_operational_status text, p_audit_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_platform_set_workspace_operational_status(p_workspace_id uuid, p_actor_user_id uuid, p_operational_status text, p_audit_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_platform_set_workspace_operational_status(p_workspace_id uuid, p_actor_user_id uuid, p_operational_status text, p_audit_event_id uuid) TO slotera_app;


--
-- Name: FUNCTION slotera_public_booking_access(p_token_hash bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_public_booking_access(p_token_hash bytea) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_public_booking_access(p_token_hash bytea) TO slotera_app;


--
-- Name: FUNCTION slotera_public_create_inquiry(p_id uuid, p_name text, p_email text, p_company text, p_reason text, p_message text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_public_create_inquiry(p_id uuid, p_name text, p_email text, p_company text, p_reason text, p_message text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_public_create_inquiry(p_id uuid, p_name text, p_email text, p_company text, p_reason text, p_message text) TO slotera_app;


--
-- Name: FUNCTION slotera_public_resolve_workspace(p_slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_public_resolve_workspace(p_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_public_resolve_workspace(p_slug text) TO slotera_app;


--
-- Name: FUNCTION slotera_rate_limit_consume(p_scope text, p_key_hash bytea, p_limit integer, p_window_seconds integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_rate_limit_consume(p_scope text, p_key_hash bytea, p_limit integer, p_window_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_rate_limit_consume(p_scope text, p_key_hash bytea, p_limit integer, p_window_seconds integer) TO slotera_app;


--
-- Name: FUNCTION slotera_series_due_extension(p_horizon_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_series_due_extension(p_horizon_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_series_due_extension(p_horizon_days integer) TO slotera_app;


--
-- Name: FUNCTION slotera_workspace_create_with_owner(p_workspace_id uuid, p_owner_user_id uuid, p_membership_id uuid, p_audit_event_id uuid, p_actor_user_id uuid, p_audit_action text, p_name text, p_slug text, p_owner_first_names text, p_owner_last_name text, p_owner_email text, p_timezone text, p_currency text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_workspace_create_with_owner(p_workspace_id uuid, p_owner_user_id uuid, p_membership_id uuid, p_audit_event_id uuid, p_actor_user_id uuid, p_audit_action text, p_name text, p_slug text, p_owner_first_names text, p_owner_last_name text, p_owner_email text, p_timezone text, p_currency text) FROM PUBLIC;


--
-- Name: FUNCTION slotera_workspace_purge_closed(p_after_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_workspace_purge_closed(p_after_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_workspace_purge_closed(p_after_days integer) TO slotera_app;


--
-- Name: FUNCTION slotera_workspace_request_closure(p_workspace_id uuid, p_actor_user_id uuid, p_audit_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.slotera_workspace_request_closure(p_workspace_id uuid, p_actor_user_id uuid, p_audit_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.slotera_workspace_request_closure(p_workspace_id uuid, p_actor_user_id uuid, p_audit_event_id uuid) TO slotera_app;


--
-- Name: TABLE audit_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.audit_events TO slotera_app;


--
-- Name: TABLE availability_blackouts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.availability_blackouts TO slotera_app;


--
-- Name: TABLE availability_policies; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.availability_policies TO slotera_app;


--
-- Name: TABLE availability_windows; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.availability_windows TO slotera_app;


--
-- Name: TABLE booking_access_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_access_tokens TO slotera_app;


--
-- Name: TABLE booking_command_idempotency; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_command_idempotency TO slotera_app;


--
-- Name: TABLE booking_form_responses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_form_responses TO slotera_app;


--
-- Name: TABLE booking_form_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_form_snapshots TO slotera_app;


--
-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.bookings TO slotera_app;


--
-- Name: TABLE calendar_feed_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.calendar_feed_tokens TO slotera_app;


--
-- Name: TABLE client_notes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.client_notes TO slotera_app;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.clients TO slotera_app;


--
-- Name: TABLE form_template_services; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.form_template_services TO slotera_app;


--
-- Name: TABLE form_templates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.form_templates TO slotera_app;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.notifications TO slotera_app;


--
-- Name: COLUMN notifications.read_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(read_at) ON TABLE public.notifications TO slotera_app;


--
-- Name: TABLE public_booking_idempotency; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.public_booking_idempotency TO slotera_app;


--
-- Name: TABLE reserved_workspace_slugs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.reserved_workspace_slugs TO slotera_app;


--
-- Name: TABLE service_package_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.service_package_items TO slotera_app;


--
-- Name: TABLE service_packages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.service_packages TO slotera_app;


--
-- Name: TABLE services; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.services TO slotera_app;


--
-- Name: TABLE session_action_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.session_action_items TO slotera_app;


--
-- Name: TABLE session_series; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.session_series TO slotera_app;


--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sessions TO slotera_app;


--
-- Name: TABLE workspace_business_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_business_profiles TO slotera_app;


--
-- Name: TABLE workspace_locations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_locations TO slotera_app;


--
-- Name: TABLE workspace_memberships; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_memberships TO slotera_app;


--
-- Name: TABLE workspace_payment_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_payment_settings TO slotera_app;


--
-- Name: TABLE workspace_slug_history; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_slug_history TO slotera_app;


--
-- Name: TABLE workspaces; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE public.workspaces TO slotera_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE slotera_owner IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO slotera_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE slotera_owner IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO slotera_app;


--
-- PostgreSQL database dump complete
--



CREATE INDEX ix_email_outbox_expired_claim ON public.email_outbox (claimed_at, id)
WHERE sent_at IS NULL AND suppressed_at IS NULL AND attempt_count >= 10 AND claimed_at IS NOT NULL;

CREATE INDEX ix_email_outbox_booking_created ON public.email_outbox (related_booking_id, created_at, id);

-- Safe customer-email metadata, scoped through the booking; never bodies, tokens or errors.
CREATE FUNCTION public.slotera_booking_email_history(p_booking_id uuid, p_limit integer, p_offset integer, p_client_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
AS $$
  WITH items AS (
    SELECT e.id, e.kind, e.recipient_email, e.created_at, e.sent_at, e.available_at,
      e.attempt_count,
      coalesce(e.provider_message_id LIKE 'console:%', false) AS simulated,
      CASE WHEN e.suppressed_at IS NOT NULL THEN 'superseded'
        WHEN e.sent_at IS NOT NULL THEN 'sent'
        WHEN e.claimed_at IS NOT NULL THEN 'sending'
        WHEN e.attempt_count >= 10 THEN 'failed'
        WHEN e.attempt_count > 0 THEN 'retrying' ELSE 'queued' END AS status
    FROM public.email_outbox e JOIN public.bookings b ON b.id=e.related_booking_id
    WHERE b.workspace_id=public.slotera_current_workspace_id()
      AND b.customer_email <> ''
      AND (p_booking_id IS NULL OR b.id=p_booking_id)
      AND (p_client_id IS NULL OR b.client_id=p_client_id)
      AND e.kind IN ('booking_received','booking_confirmed','booking_reminder',
        'booking_rescheduled','booking_cancelled','booking_details','booking_followup')
  ), page AS (SELECT * FROM items ORDER BY created_at DESC,id LIMIT greatest(1,least(p_limit,100)) OFFSET greatest(0,p_offset))
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id) FROM page),'[]'::jsonb),
    'total',(SELECT count(*) FROM items),'limit',greatest(1,least(p_limit,100)),'offset',greatest(0,p_offset));
$$;
REVOKE ALL ON FUNCTION public.slotera_booking_email_history(uuid,integer,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slotera_booking_email_history(uuid,integer,integer,uuid) TO slotera_app;

-- Claim and correction serialize on these rows. A claimed send must finish before correction.
CREATE FUNCTION public.slotera_booking_prepare_email_send(p_booking_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
AS $$ BEGIN
  PERFORM id FROM public.bookings WHERE id=p_booking_id
    AND workspace_id=public.slotera_current_workspace_id() AND customer_email<>'' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM id FROM public.email_outbox WHERE related_booking_id=p_booking_id
    AND kind IN ('booking_received','booking_confirmed','booking_reminder','booking_rescheduled','booking_cancelled','booking_details')
    AND sent_at IS NULL AND suppressed_at IS NULL ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.email_outbox WHERE related_booking_id=p_booking_id
    AND kind IN ('booking_received','booking_confirmed','booking_reminder','booking_rescheduled','booking_cancelled','booking_details')
    AND sent_at IS NULL AND suppressed_at IS NULL AND claimed_at IS NOT NULL) THEN RETURN false; END IF;
  UPDATE public.email_outbox SET suppressed_at=statement_timestamp(),text_body='[superseded]',template_data='{}'::jsonb
    WHERE related_booking_id=p_booking_id AND sent_at IS NULL AND suppressed_at IS NULL
    AND kind IN ('booking_received','booking_confirmed','booking_reminder','booking_rescheduled','booking_cancelled','booking_details');
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.slotera_booking_prepare_email_send(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slotera_booking_prepare_email_send(uuid) TO slotera_app;

-- Attach safe correlation metadata inside the same transaction as every queued message.
CREATE FUNCTION public.slotera_email_trace() RETURNS trigger
LANGUAGE plpgsql SET search_path TO pg_catalog AS $$
BEGIN
  IF NULLIF(current_setting('app.request_id', true), '') IS NOT NULL THEN
    NEW.template_data := NEW.template_data || jsonb_build_object(
      '_traceRequestId', current_setting('app.request_id', true),
      '_traceOperationId', current_setting('app.operation_id', true));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.slotera_email_trace() FROM PUBLIC;
CREATE TRIGGER email_trace BEFORE INSERT ON public.email_outbox
FOR EACH ROW EXECUTE FUNCTION public.slotera_email_trace();

-- Cover capability-generated audit events as well as ORM writes.
CREATE FUNCTION public.slotera_audit_trace() RETURNS trigger
LANGUAGE plpgsql SET search_path TO pg_catalog AS $$
BEGIN
  IF NULLIF(current_setting('app.request_id', true), '') IS NOT NULL THEN
    NEW.details := COALESCE(NEW.details, '{}'::jsonb) || jsonb_build_object(
      'requestId', current_setting('app.request_id', true),
      'operationId', current_setting('app.operation_id', true));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.slotera_audit_trace() FROM PUBLIC;
CREATE TRIGGER audit_trace BEFORE INSERT ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.slotera_audit_trace();

-- Bounded status pages and a client's recent bookings use these stable orderings.
CREATE INDEX ix_bookings_workspace_status_created ON public.bookings(workspace_id, status, created_at DESC, id);
CREATE INDEX ix_bookings_workspace_client_created ON public.bookings(workspace_id, client_id, created_at DESC, id);

-- Reviewed edit revisions are independent of booking snapshots and command idempotency.
ALTER TABLE public.clients ADD COLUMN version bigint DEFAULT 1 NOT NULL;
ALTER TABLE public.services ADD COLUMN version bigint DEFAULT 1 NOT NULL;
ALTER TABLE public.workspace_locations ADD COLUMN version bigint DEFAULT 1 NOT NULL;
ALTER TABLE public.form_templates ADD COLUMN version bigint DEFAULT 1 NOT NULL;
ALTER TABLE public.service_packages ADD COLUMN version bigint DEFAULT 1 NOT NULL;
ALTER TABLE public.client_notes ADD COLUMN version bigint DEFAULT 1 NOT NULL;
ALTER TABLE public.session_action_items ADD COLUMN version bigint DEFAULT 1 NOT NULL;
ALTER TABLE public.sessions ADD COLUMN version bigint DEFAULT 1 NOT NULL;
ALTER TABLE public.session_series ADD COLUMN version bigint DEFAULT 1 NOT NULL;
ALTER TABLE public.workspace_business_profiles ADD COLUMN version bigint DEFAULT 1 NOT NULL;

ALTER TABLE public.session_series ADD COLUMN cancelled_from date;
ALTER TABLE public.session_series
 ADD COLUMN service_id uuid NOT NULL,
 ADD COLUMN calendar_owner_id uuid NOT NULL,
 ADD COLUMN start_local time without time zone NOT NULL,
 ADD COLUMN duration_min integer NOT NULL,
 ADD COLUMN capacity integer NOT NULL,
 ADD COLUMN location_type public.location_type NOT NULL,
 ADD COLUMN location varchar(240) NOT NULL,
 ADD COLUMN address jsonb,
 ADD COLUMN notes varchar(2000),
 ADD CONSTRAINT fk_session_series_workspace_id_services FOREIGN KEY(workspace_id,service_id) REFERENCES public.services(workspace_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_session_series_workspace_id_workspace_memberships FOREIGN KEY(workspace_id,calendar_owner_id) REFERENCES public.workspace_memberships(workspace_id,user_id) ON DELETE RESTRICT,
 ADD CONSTRAINT ck_session_series_template_duration CHECK(duration_min >= 1),
 ADD CONSTRAINT ck_session_series_template_capacity CHECK(capacity BETWEEN 1 AND 10000);
CREATE TABLE public.session_command_idempotency (
 id uuid CONSTRAINT pk_session_command_idempotency PRIMARY KEY,
 workspace_id uuid NOT NULL CONSTRAINT fk_session_command_idempotency_workspace_id_workspaces REFERENCES public.workspaces(id) ON DELETE CASCADE,
 actor_user_id uuid NOT NULL CONSTRAINT fk_session_command_idempotency_actor_user_id_users REFERENCES public.users(id) ON DELETE RESTRICT,
 session_id uuid NOT NULL,
 idempotency_key varchar(255) NOT NULL,
 request_fingerprint varchar(64) NOT NULL,
 outcome jsonb NOT NULL,
 created_at timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT uq_session_command_idempotency_workspace_id UNIQUE(workspace_id,actor_user_id,idempotency_key),
 CONSTRAINT fk_session_command_idempotency_workspace_id_sessions FOREIGN KEY(workspace_id,session_id) REFERENCES public.sessions(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX ix_session_command_idempotency_workspace_id ON public.session_command_idempotency(workspace_id);
ALTER TABLE public.session_command_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_command_idempotency FORCE ROW LEVEL SECURITY;
CREATE POLICY session_commands_tenant ON public.session_command_idempotency
 USING (workspace_id=public.slotera_current_workspace_id())
 WITH CHECK (workspace_id=public.slotera_current_workspace_id());
GRANT SELECT,INSERT,DELETE ON public.session_command_idempotency TO slotera_app;

ALTER TABLE public.clients
 ADD COLUMN erased_at timestamptz,
 ADD COLUMN preferred_language varchar(2) DEFAULT 'en' NOT NULL,
 ADD COLUMN message_digest_enabled boolean DEFAULT true NOT NULL,
 ADD COLUMN automatic_followup_enabled boolean DEFAULT true NOT NULL;
CREATE TABLE public.client_login_tokens (
 id uuid CONSTRAINT pk_client_login_tokens PRIMARY KEY,
 workspace_id uuid NOT NULL CONSTRAINT fk_client_login_tokens_workspace_id_workspaces REFERENCES public.workspaces(id) ON DELETE CASCADE,
 client_id uuid NOT NULL,
 language varchar(2) DEFAULT 'en' NOT NULL,
 token_hash bytea NOT NULL CONSTRAINT uq_client_login_tokens_token_hash UNIQUE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT fk_client_login_tokens_workspace_id_clients FOREIGN KEY(workspace_id,client_id) REFERENCES public.clients(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE public.client_auth_sessions (
 id uuid CONSTRAINT pk_client_auth_sessions PRIMARY KEY,
 workspace_id uuid NOT NULL CONSTRAINT fk_client_auth_sessions_workspace_id_workspaces REFERENCES public.workspaces(id) ON DELETE CASCADE,
 client_id uuid NOT NULL,
 token_hash bytea NOT NULL CONSTRAINT uq_client_auth_sessions_token_hash UNIQUE,
 csrf_hash bytea NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT fk_client_auth_sessions_workspace_id_clients FOREIGN KEY(workspace_id,client_id) REFERENCES public.clients(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX ix_client_login_tokens_expires_at ON public.client_login_tokens(expires_at);
CREATE INDEX ix_client_auth_sessions_expires_at ON public.client_auth_sessions(expires_at);
CREATE INDEX ix_client_login_tokens_client ON public.client_login_tokens(workspace_id,client_id);
CREATE INDEX ix_client_auth_sessions_client ON public.client_auth_sessions(workspace_id,client_id);
ALTER TABLE public.client_login_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_login_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_auth_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY client_login_tokens_tenant ON public.client_login_tokens USING(workspace_id=public.slotera_current_workspace_id()) WITH CHECK(workspace_id=public.slotera_current_workspace_id());
CREATE POLICY client_auth_sessions_tenant ON public.client_auth_sessions USING(workspace_id=public.slotera_current_workspace_id()) WITH CHECK(workspace_id=public.slotera_current_workspace_id());
-- Authentication records are available only through the fixed capabilities below.
CREATE FUNCTION public.slotera_client_identity(p_token bytea) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 SELECT jsonb_build_object('clientId',c.id,'workspaceId',w.id,'workspaceName',w.name,
 'slug',w.slug,'name',c.name,'email',c.email,'language',c.preferred_language,
 'messageDigestEnabled',c.message_digest_enabled,'automaticFollowupEnabled',c.automatic_followup_enabled,
 'expiresAt',a.expires_at,'_csrfHash',encode(a.csrf_hash,'hex'))
 FROM public.client_auth_sessions a JOIN public.clients c ON c.workspace_id=a.workspace_id AND c.id=a.client_id
 JOIN public.workspaces w ON w.id=c.workspace_id
 WHERE a.token_hash=p_token AND a.expires_at>statement_timestamp()
 AND c.erased_at IS NULL AND w.operational_status='active';
$$;
CREATE FUNCTION public.slotera_client_login_issue(p_slug text,p_email text,p_hash bytea,p_url text,p_language text,p_subject text,p_body text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE target record;
 BEGIN
 SELECT c.id,c.workspace_id INTO target FROM public.clients c JOIN public.workspaces w ON w.id=c.workspace_id
 WHERE w.slug=p_slug AND w.operational_status='active' AND c.email=p_email AND c.erased_at IS NULL;
 IF NOT FOUND THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('slotera:scheduling:'||target.workspace_id,0));
 PERFORM 1 FROM public.clients WHERE workspace_id=target.workspace_id AND id=target.id AND email=p_email AND erased_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO public.client_login_tokens(id,workspace_id,client_id,token_hash,expires_at,language)
 VALUES(gen_random_uuid(),target.workspace_id,target.id,p_hash,statement_timestamp()+interval '15 minutes',p_language);
 INSERT INTO public.email_outbox(id,kind,recipient_email,subject,text_body,template_data,related_workspace_id)
 VALUES(gen_random_uuid(),'client_sign_in',p_email,p_subject,p_body || E'\n\n' || p_url,
 jsonb_build_object('language',p_language,'clientId',target.id,'workspaceId',target.workspace_id),target.workspace_id);
 END;
$$;
CREATE FUNCTION public.slotera_client_login_consume(p_link bytea,p_session bytea,p_csrf bytea) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE target public.client_login_tokens%ROWTYPE;
 BEGIN
 SELECT * INTO target FROM public.client_login_tokens WHERE token_hash=p_link AND expires_at>statement_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('slotera:scheduling:'||target.workspace_id,0));
 PERFORM 1 FROM public.clients c JOIN public.workspaces w ON w.id=c.workspace_id
 WHERE c.id=target.client_id AND c.workspace_id=target.workspace_id AND c.erased_at IS NULL AND w.operational_status='active' FOR UPDATE OF c;
 IF NOT FOUND THEN RETURN NULL; END IF;
 DELETE FROM public.client_login_tokens WHERE id=target.id AND expires_at>statement_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public.clients SET preferred_language=target.language WHERE workspace_id=target.workspace_id AND id=target.client_id;
 INSERT INTO public.client_auth_sessions(id,workspace_id,client_id,token_hash,csrf_hash,expires_at)
 VALUES(gen_random_uuid(),target.workspace_id,target.client_id,p_session,p_csrf,statement_timestamp()+interval '12 hours');
 RETURN public.slotera_client_identity(p_session);
 END;
$$;
CREATE FUNCTION public.slotera_client_logout(p_token bytea) RETURNS void
 LANGUAGE sql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DELETE FROM public.client_auth_sessions WHERE token_hash=p_token;
$$;
CREATE FUNCTION public.slotera_client_preferences(p_token bytea,p_language text,p_digest boolean,p_followup boolean) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE identity jsonb;
 BEGIN
 identity:=public.slotera_client_identity(p_token);
 IF identity IS NULL THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('slotera:scheduling:'||(identity->>'workspaceId'),0));
 identity:=public.slotera_client_identity(p_token);
 IF identity IS NULL THEN RETURN NULL; END IF;
 IF p_language IS NOT NULL AND p_language NOT IN ('en','tr','de') THEN RAISE EXCEPTION 'invalid language'; END IF;
 UPDATE public.clients SET preferred_language=coalesce(p_language,preferred_language),
 message_digest_enabled=coalesce(p_digest,message_digest_enabled),automatic_followup_enabled=coalesce(p_followup,automatic_followup_enabled)
 WHERE id=(identity->>'clientId')::uuid AND workspace_id=(identity->>'workspaceId')::uuid;
 RETURN public.slotera_client_identity(p_token);
 END;
$$;
CREATE FUNCTION public.slotera_client_bookings(p_token bytea,p_limit integer,p_offset integer) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE identity jsonb; result jsonb; n integer;
 BEGIN
 identity:=public.slotera_client_identity(p_token);
 IF identity IS NULL THEN RETURN NULL; END IF;
 SELECT count(*) INTO n FROM public.bookings b WHERE b.workspace_id=(identity->>'workspaceId')::uuid AND b.client_id=(identity->>'clientId')::uuid;
 SELECT coalesce(jsonb_agg(to_jsonb(rows)),'[]') INTO result FROM (
 SELECT b.id,b.reference,b.status,b.payment_status AS "paymentStatus",b.amount_cents AS "amountCents",b.currency,
 s.start_at AS "startAt",s.end_at AS "endAt",v.name AS "serviceName"
 FROM public.bookings b JOIN public.sessions s ON s.workspace_id=b.workspace_id AND s.id=b.session_id
 JOIN public.services v ON v.workspace_id=s.workspace_id AND v.id=s.service_id
 WHERE b.workspace_id=(identity->>'workspaceId')::uuid AND b.client_id=(identity->>'clientId')::uuid
 ORDER BY s.start_at DESC,b.id LIMIT least(greatest(p_limit,1),100) OFFSET greatest(p_offset,0)
 ) rows;
 RETURN jsonb_build_object('items',result,'total',n,'limit',least(greatest(p_limit,1),100),'offset',greatest(p_offset,0));
 END;
$$;
REVOKE ALL ON FUNCTION public.slotera_client_identity(bytea),public.slotera_client_login_issue(text,text,bytea,text,text,text,text),public.slotera_client_login_consume(bytea,bytea,bytea),public.slotera_client_logout(bytea),public.slotera_client_preferences(bytea,text,boolean,boolean),public.slotera_client_bookings(bytea,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slotera_client_identity(bytea),public.slotera_client_login_issue(text,text,bytea,text,text,text,text),public.slotera_client_login_consume(bytea,bytea,bytea),public.slotera_client_logout(bytea),public.slotera_client_preferences(bytea,text,boolean,boolean),public.slotera_client_bookings(bytea,integer,integer) TO slotera_app;

CREATE TABLE public.client_conversations (
 id uuid CONSTRAINT pk_client_conversations PRIMARY KEY,
 workspace_id uuid NOT NULL CONSTRAINT fk_client_conversations_workspace_id_workspaces REFERENCES public.workspaces(id) ON DELETE CASCADE,
 client_id uuid NOT NULL,
 last_sequence bigint DEFAULT 0 NOT NULL,
 created_at timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT uq_client_conversations_workspace_id UNIQUE(workspace_id,id),
 CONSTRAINT uq_client_conversations_workspace_id_client UNIQUE(workspace_id,client_id),
 CONSTRAINT fk_client_conversations_workspace_id_clients FOREIGN KEY(workspace_id,client_id) REFERENCES public.clients(workspace_id,id) ON DELETE CASCADE
);
CREATE TABLE public.conversation_messages (
 id uuid CONSTRAINT pk_conversation_messages PRIMARY KEY,
 workspace_id uuid NOT NULL CONSTRAINT fk_conversation_messages_workspace_id_workspaces REFERENCES public.workspaces(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL,
 sequence bigint NOT NULL,
 sender_key varchar(80) NOT NULL,
 sender_kind varchar(10) NOT NULL,
 submission_id uuid NOT NULL,
 body varchar(4000) NOT NULL,
 created_at timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT uq_conversation_messages_sequence UNIQUE(workspace_id,conversation_id,sequence),
 CONSTRAINT uq_conversation_messages_submission UNIQUE(workspace_id,conversation_id,sender_key,submission_id),
 CONSTRAINT fk_conversation_messages_workspace_id_client_conversations FOREIGN KEY(workspace_id,conversation_id) REFERENCES public.client_conversations(workspace_id,id) ON DELETE CASCADE,
 CONSTRAINT ck_conversation_messages_body CHECK(char_length(btrim(body)) BETWEEN 1 AND 4000),
 CONSTRAINT ck_conversation_messages_sender_kind CHECK(sender_kind IN ('client','operator'))
);
CREATE TABLE public.conversation_reads (
 workspace_id uuid NOT NULL CONSTRAINT fk_conversation_reads_workspace_id_workspaces REFERENCES public.workspaces(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL,
 actor_key varchar(80) NOT NULL,
 last_read bigint DEFAULT 0 NOT NULL,
 last_digest bigint DEFAULT 0 NOT NULL,
 CONSTRAINT pk_conversation_reads PRIMARY KEY(workspace_id,conversation_id,actor_key),
 CONSTRAINT fk_conversation_reads_workspace_id_client_conversations FOREIGN KEY(workspace_id,conversation_id) REFERENCES public.client_conversations(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX ix_conversation_messages_tail ON public.conversation_messages(workspace_id,conversation_id,sequence DESC);
ALTER TABLE public.client_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY client_conversations_tenant ON public.client_conversations USING(workspace_id=public.slotera_current_workspace_id()) WITH CHECK(workspace_id=public.slotera_current_workspace_id());
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY conversation_messages_tenant ON public.conversation_messages USING(workspace_id=public.slotera_current_workspace_id()) WITH CHECK(workspace_id=public.slotera_current_workspace_id());
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reads FORCE ROW LEVEL SECURITY;
CREATE POLICY conversation_reads_tenant ON public.conversation_reads USING(workspace_id=public.slotera_current_workspace_id()) WITH CHECK(workspace_id=public.slotera_current_workspace_id());
GRANT SELECT ON public.client_conversations,public.conversation_messages,public.conversation_reads TO slotera_app;
CREATE FUNCTION public.slotera_conversation_actor(p_token bytea,p_client uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE identity jsonb; wid uuid; uid uuid;
 BEGIN
 IF p_token IS NOT NULL THEN
 identity:=public.slotera_client_identity(p_token);
 IF identity IS NULL OR (p_client IS NOT NULL AND (identity->>'clientId')::uuid<>p_client) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('workspaceId',identity->>'workspaceId','clientId',identity->>'clientId','actorKey','client:'||(identity->>'clientId'),'senderKind','client');
 END IF;
 wid:=public.slotera_current_workspace_id(); uid:=nullif(current_setting('app.current_user_id',true),'')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.workspace_memberships WHERE workspace_id=wid AND user_id=uid) THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE workspace_id=wid AND id=p_client AND erased_at IS NULL) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('workspaceId',wid,'clientId',p_client,'actorKey','operator:'||uid,'senderKind','operator','userId',uid);
 END;
$$;
CREATE FUNCTION public.slotera_conversation_messages(p_token bytea,p_client uuid,p_before bigint,p_after bigint,p_limit integer) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE actor jsonb; records jsonb; latest bigint; read_sequence bigint;
 BEGIN
 actor:=public.slotera_conversation_actor(p_token,p_client);
 IF actor IS NULL THEN RETURN NULL; END IF;
 SELECT coalesce(c.last_sequence,0) INTO latest FROM public.client_conversations c WHERE c.workspace_id=(actor->>'workspaceId')::uuid AND c.client_id=(actor->>'clientId')::uuid;
 SELECT coalesce(r.last_read,0) INTO read_sequence FROM public.conversation_reads r WHERE r.workspace_id=(actor->>'workspaceId')::uuid AND r.conversation_id=(actor->>'clientId')::uuid AND r.actor_key=actor->>'actorKey';
 SELECT coalesce(jsonb_agg(to_jsonb(rows) ORDER BY rows.sequence),'[]') INTO records FROM (
 SELECT m.id,m.sequence,m.sender_kind AS "senderKind",m.body,m.created_at AS "createdAt" FROM public.conversation_messages m
 WHERE m.workspace_id=(actor->>'workspaceId')::uuid AND m.conversation_id=(actor->>'clientId')::uuid
 AND (p_before IS NULL OR m.sequence<p_before) AND (p_after IS NULL OR m.sequence>p_after)
 ORDER BY CASE WHEN p_after IS NOT NULL THEN m.sequence END ASC, m.sequence DESC
 LIMIT least(greatest(p_limit,1),100)
 ) rows;
 RETURN jsonb_build_object('items',records,'latestSequence',coalesce(latest,0),'readThrough',coalesce(read_sequence,0),'limit',least(greatest(p_limit,1),100));
 END;
$$;
CREATE FUNCTION public.slotera_conversation_send(p_token bytea,p_client uuid,p_submission uuid,p_body text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE actor jsonb; existing public.conversation_messages%ROWTYPE; next_sequence bigint; result jsonb;
 BEGIN
 actor:=public.slotera_conversation_actor(p_token,p_client);
 IF actor IS NULL THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('slotera:scheduling:'||(actor->>'workspaceId'),0));
 PERFORM 1 FROM public.clients WHERE workspace_id=(actor->>'workspaceId')::uuid AND id=(actor->>'clientId')::uuid AND erased_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF p_token IS NOT NULL AND public.slotera_client_identity(p_token) IS NULL THEN RETURN NULL; END IF;
 INSERT INTO public.client_conversations(id,workspace_id,client_id) VALUES((actor->>'clientId')::uuid,(actor->>'workspaceId')::uuid,(actor->>'clientId')::uuid) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM public.client_conversations WHERE workspace_id=(actor->>'workspaceId')::uuid AND id=(actor->>'clientId')::uuid FOR UPDATE;
 SELECT * INTO existing FROM public.conversation_messages WHERE workspace_id=(actor->>'workspaceId')::uuid AND conversation_id=(actor->>'clientId')::uuid AND sender_key=actor->>'actorKey' AND submission_id=p_submission;
 IF FOUND THEN
 IF existing.body<>p_body THEN RETURN jsonb_build_object('error','idempotency_key_reused'); END IF;
 RETURN jsonb_build_object('id',existing.id,'sequence',existing.sequence,'senderKind',existing.sender_kind,'body',existing.body,'createdAt',existing.created_at);
 END IF;
 IF char_length(btrim(p_body)) NOT BETWEEN 1 AND 4000 THEN RETURN jsonb_build_object('error','message_invalid'); END IF;
 IF NOT public.slotera_rate_limit_consume('conversation_send',sha256(convert_to((actor->>'workspaceId')||':'||(actor->>'actorKey'),'UTF8')),30,60) THEN RETURN jsonb_build_object('error','rate_limit_exceeded'); END IF;
 UPDATE public.client_conversations SET last_sequence=last_sequence+1 WHERE workspace_id=(actor->>'workspaceId')::uuid AND id=(actor->>'clientId')::uuid RETURNING last_sequence INTO next_sequence;
 INSERT INTO public.conversation_messages(id,workspace_id,conversation_id,sequence,sender_key,sender_kind,submission_id,body)
 VALUES(gen_random_uuid(),(actor->>'workspaceId')::uuid,(actor->>'clientId')::uuid,next_sequence,actor->>'actorKey',actor->>'senderKind',p_submission,p_body)
 RETURNING jsonb_build_object('id',id,'sequence',sequence,'senderKind',sender_kind,'body',body,'createdAt',created_at) INTO result;
 INSERT INTO public.audit_events(id,workspace_id,actor_user_id,action,resource_type,resource_id,details)
 VALUES(gen_random_uuid(),(actor->>'workspaceId')::uuid,(actor->>'userId')::uuid,'conversation.message_sent','conversation_message',(result->>'id')::uuid,jsonb_build_object('senderKind',actor->>'senderKind'));
 RETURN result;
 END;
$$;
CREATE FUNCTION public.slotera_conversation_mark_read(p_token bytea,p_client uuid,p_sequence bigint) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE actor jsonb; latest bigint;
 BEGIN
 actor:=public.slotera_conversation_actor(p_token,p_client);
 IF actor IS NULL THEN RETURN false; END IF;
 PERFORM 1 FROM public.clients WHERE workspace_id=(actor->>'workspaceId')::uuid AND id=(actor->>'clientId')::uuid AND erased_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_token IS NOT NULL AND public.slotera_client_identity(p_token) IS NULL THEN RETURN false; END IF;
 SELECT last_sequence INTO latest FROM public.client_conversations WHERE workspace_id=(actor->>'workspaceId')::uuid AND id=(actor->>'clientId')::uuid;
 IF latest IS NULL THEN RETURN true; END IF;
 INSERT INTO public.conversation_reads(workspace_id,conversation_id,actor_key,last_read)
 VALUES((actor->>'workspaceId')::uuid,(actor->>'clientId')::uuid,actor->>'actorKey',greatest(0,least(p_sequence,latest)))
 ON CONFLICT(workspace_id,conversation_id,actor_key) DO UPDATE SET last_read=greatest(conversation_reads.last_read,EXCLUDED.last_read);
 RETURN true;
 END;
$$;
CREATE FUNCTION public.slotera_client_booking_access(p_token bytea,p_booking uuid,p_hash bytea) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE identity jsonb; ends timestamptz;
 BEGIN
 identity:=public.slotera_client_identity(p_token); IF identity IS NULL THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('slotera:scheduling:'||(identity->>'workspaceId'),0));
 IF public.slotera_client_identity(p_token) IS NULL THEN RETURN false; END IF;
 SELECT s.end_at INTO ends FROM public.bookings b JOIN public.sessions s ON s.workspace_id=b.workspace_id AND s.id=b.session_id
 WHERE b.id=p_booking AND b.client_id=(identity->>'clientId')::uuid AND b.workspace_id=(identity->>'workspaceId')::uuid;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.booking_access_tokens(id,workspace_id,booking_id,token_hash,expires_at)
 VALUES(gen_random_uuid(),(identity->>'workspaceId')::uuid,p_booking,p_hash,greatest(ends,statement_timestamp())+interval '30 days');
 RETURN true;
 END;
$$;
REVOKE ALL ON FUNCTION public.slotera_conversation_actor(bytea,uuid),public.slotera_conversation_messages(bytea,uuid,bigint,bigint,integer),public.slotera_conversation_send(bytea,uuid,uuid,text),public.slotera_conversation_mark_read(bytea,uuid,bigint),public.slotera_client_booking_access(bytea,uuid,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slotera_conversation_messages(bytea,uuid,bigint,bigint,integer),public.slotera_conversation_send(bytea,uuid,uuid,text),public.slotera_conversation_mark_read(bytea,uuid,bigint),public.slotera_client_booking_access(bytea,uuid,bytea) TO slotera_app;

ALTER TABLE public.booking_form_snapshots ADD COLUMN assignment_kind varchar(20) DEFAULT 'preparation' NOT NULL, ADD COLUMN response_deadline timestamptz;
ALTER TABLE public.booking_form_snapshots DROP CONSTRAINT booking_form_snapshots_workspace_id_booking_id_form_templat_key;
ALTER TABLE public.booking_form_snapshots ADD CONSTRAINT booking_form_snapshots_workspace_id_booking_id_form_templat_key UNIQUE(workspace_id,booking_id,form_template_id,assignment_kind);
ALTER TABLE public.booking_form_responses DROP CONSTRAINT uq_booking_form_response;
ALTER TABLE public.booking_form_snapshots ADD CONSTRAINT uq_booking_form_snapshots_assignment UNIQUE(workspace_id,booking_id,id), ADD CONSTRAINT ck_booking_form_snapshots_assignment_kind CHECK(assignment_kind IN ('preparation','followup'));
ALTER TABLE public.booking_form_responses ADD COLUMN snapshot_id uuid NOT NULL;
ALTER TABLE public.booking_form_responses ADD CONSTRAINT fk_booking_form_responses_workspace_id_booking_form_snapshots FOREIGN KEY(workspace_id,booking_id,snapshot_id) REFERENCES public.booking_form_snapshots(workspace_id,booking_id,id) ON DELETE CASCADE;
ALTER TABLE public.booking_form_responses ADD CONSTRAINT uq_booking_form_response UNIQUE(workspace_id,booking_id,snapshot_id);

CREATE TABLE public.service_followup_rules (
 workspace_id uuid NOT NULL CONSTRAINT fk_service_followup_rules_workspace_id_workspaces REFERENCES public.workspaces(id) ON DELETE CASCADE,
 service_id uuid NOT NULL,
 enabled boolean DEFAULT false NOT NULL,
 delay_hours integer DEFAULT 24 NOT NULL,
 message varchar(5000) DEFAULT '' NOT NULL,
 form_template_id uuid,
 CONSTRAINT pk_service_followup_rules PRIMARY KEY(workspace_id,service_id),
 CONSTRAINT fk_service_followup_rules_workspace_id_services FOREIGN KEY(workspace_id,service_id) REFERENCES public.services(workspace_id,id) ON DELETE CASCADE,
 CONSTRAINT fk_service_followup_rules_workspace_id_form_templates FOREIGN KEY(workspace_id,form_template_id) REFERENCES public.form_templates(workspace_id,id) ON DELETE RESTRICT,
 CONSTRAINT ck_service_followup_rules_delay CHECK(delay_hours BETWEEN 0 AND 720)
);
CREATE TABLE public.booking_followups (
 id uuid CONSTRAINT pk_booking_followups PRIMARY KEY,
 workspace_id uuid NOT NULL CONSTRAINT fk_booking_followups_workspace_id_workspaces REFERENCES public.workspaces(id) ON DELETE CASCADE,
 booking_id uuid NOT NULL,
 state varchar(16) NOT NULL,
 message varchar(5000) NOT NULL,
 delay_hours integer DEFAULT 24 NOT NULL,
 due_at timestamptz NOT NULL,
 form_snapshot_id uuid,
 CONSTRAINT fk_booking_followups_workspace_id_booking_form_snapshots FOREIGN KEY(workspace_id,booking_id,form_snapshot_id) REFERENCES public.booking_form_snapshots(workspace_id,booking_id,id) ON DELETE CASCADE,
 queued_at timestamptz,
 commands jsonb DEFAULT '{}'::jsonb NOT NULL,
 version bigint DEFAULT 1 NOT NULL,
 created_at timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT uq_booking_followups_workspace_id UNIQUE(workspace_id,booking_id),
 CONSTRAINT fk_booking_followups_workspace_id_bookings FOREIGN KEY(workspace_id,booking_id) REFERENCES public.bookings(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX ix_booking_followups_due ON public.booking_followups(state,due_at);
ALTER TABLE public.service_followup_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_followup_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY service_followup_rules_tenant ON public.service_followup_rules USING(workspace_id=public.slotera_current_workspace_id()) WITH CHECK(workspace_id=public.slotera_current_workspace_id());
ALTER TABLE public.booking_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_followups FORCE ROW LEVEL SECURITY;
CREATE POLICY booking_followups_tenant ON public.booking_followups USING(workspace_id=public.slotera_current_workspace_id()) WITH CHECK(workspace_id=public.slotera_current_workspace_id());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.service_followup_rules,public.booking_followups TO slotera_app;
CREATE FUNCTION public.slotera_due_followups() RETURNS TABLE(workspace_id uuid,booking_id uuid)
 LANGUAGE sql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 SELECT f.workspace_id,f.booking_id FROM public.booking_followups f JOIN public.workspaces w ON w.id=f.workspace_id
 WHERE f.state='scheduled' AND f.due_at<=statement_timestamp() AND w.operational_status='active' ORDER BY f.due_at,f.id LIMIT 100;
$$;
CREATE FUNCTION public.slotera_followup_queue(p_booking uuid,p_url text,p_subject text,p_body text,p_manual boolean,p_event_key text DEFAULT '') RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE b public.bookings%ROWTYPE; c public.clients%ROWTYPE;
 BEGIN
 SELECT * INTO b FROM public.bookings WHERE workspace_id=public.slotera_current_workspace_id() AND id=p_booking FOR UPDATE;
 IF NOT FOUND OR b.status<>'completed' OR b.customer_email='' THEN RETURN false; END IF;
 SELECT * INTO c FROM public.clients WHERE workspace_id=b.workspace_id AND id=b.client_id;
 IF c.erased_at IS NOT NULL OR (NOT p_manual AND NOT c.automatic_followup_enabled) THEN RETURN false; END IF;
 INSERT INTO public.email_outbox(id,kind,recipient_email,subject,text_body,template_data,related_booking_id,event_key)
 VALUES(gen_random_uuid(),'booking_followup',coalesce(b.delivery_email_override,b.customer_email),p_subject,p_body||E'\n\n'||p_url,
 jsonb_build_object('language',b.language,'manual',p_manual),b.id,p_event_key) ON CONFLICT DO NOTHING;
 RETURN FOUND;
 END;
$$;
CREATE FUNCTION public.slotera_followup_suppress(p_booking uuid) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.bookings WHERE workspace_id=public.slotera_current_workspace_id() AND id=p_booking) THEN RETURN false; END IF;
 PERFORM 1 FROM public.email_outbox WHERE related_booking_id=p_booking AND kind='booking_followup' AND sent_at IS NULL AND suppressed_at IS NULL ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.email_outbox WHERE related_booking_id=p_booking AND kind='booking_followup' AND sent_at IS NULL AND suppressed_at IS NULL AND claimed_at IS NOT NULL) THEN RETURN false; END IF;
 UPDATE public.email_outbox SET suppressed_at=statement_timestamp() WHERE related_booking_id=p_booking AND kind='booking_followup' AND sent_at IS NULL AND suppressed_at IS NULL;
 RETURN true;
 END;
$$;
REVOKE ALL ON FUNCTION public.slotera_due_followups(),public.slotera_followup_queue(uuid,text,text,text,boolean,text),public.slotera_followup_suppress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slotera_due_followups(),public.slotera_followup_queue(uuid,text,text,text,boolean,text),public.slotera_followup_suppress(uuid) TO slotera_app;

CREATE TABLE public.client_email_commands (
 id uuid CONSTRAINT pk_client_email_commands PRIMARY KEY,
 workspace_id uuid NOT NULL CONSTRAINT fk_client_email_commands_workspace_id_workspaces REFERENCES public.workspaces(id) ON DELETE CASCADE,
 actor_user_id uuid NOT NULL CONSTRAINT fk_client_email_commands_actor_user_id_users REFERENCES public.users(id) ON DELETE RESTRICT,
 client_id uuid NOT NULL,
 idempotency_key varchar(255) NOT NULL,
 fingerprint varchar(64) NOT NULL,
 created_at timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT fk_client_email_commands_workspace_id_clients FOREIGN KEY(workspace_id,client_id) REFERENCES public.clients(workspace_id,id) ON DELETE CASCADE,
 CONSTRAINT uq_client_email_commands_key UNIQUE(workspace_id,actor_user_id,idempotency_key)
);
ALTER TABLE public.client_email_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_email_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY client_email_commands_tenant ON public.client_email_commands USING(workspace_id=public.slotera_current_workspace_id()) WITH CHECK(workspace_id=public.slotera_current_workspace_id());
GRANT SELECT,INSERT,DELETE ON public.client_email_commands TO slotera_app;
CREATE FUNCTION public.slotera_client_contact_prepare(p_client uuid,p_email text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE wid uuid; summaries jsonb; followups jsonb;
 BEGIN
 wid:=public.slotera_current_workspace_id();
 PERFORM id FROM public.clients WHERE workspace_id=wid AND id=p_client FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM id FROM public.bookings WHERE workspace_id=wid AND client_id=p_client ORDER BY id FOR UPDATE;
 PERFORM e.id FROM public.email_outbox e LEFT JOIN public.bookings b ON b.id=e.related_booking_id
 WHERE (b.workspace_id=wid AND b.client_id=p_client) OR (e.template_data->>'workspaceId'=wid::text AND e.template_data->>'clientId'=p_client::text)
 ORDER BY e.id FOR UPDATE OF e;
 IF EXISTS(SELECT 1 FROM public.email_outbox e LEFT JOIN public.bookings b ON b.id=e.related_booking_id
 WHERE ((b.workspace_id=wid AND b.client_id=p_client) OR (e.template_data->>'workspaceId'=wid::text AND e.template_data->>'clientId'=p_client::text)) AND e.sent_at IS NULL AND e.suppressed_at IS NULL AND e.claimed_at IS NOT NULL) THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(DISTINCT e.related_booking_id),'[]') INTO summaries FROM public.email_outbox e JOIN public.bookings b ON b.id=e.related_booking_id
 WHERE b.workspace_id=wid AND b.client_id=p_client AND e.kind IN ('booking_received','booking_confirmed','booking_reminder','booking_rescheduled','booking_details','booking_cancelled') AND e.sent_at IS NULL AND e.suppressed_at IS NULL;
 SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('bookingId',e.related_booking_id,'manual',coalesce((e.template_data->>'manual')::boolean,false))),'[]') INTO followups FROM public.email_outbox e JOIN public.bookings b ON b.id=e.related_booking_id
 WHERE b.workspace_id=wid AND b.client_id=p_client AND e.kind='booking_followup' AND e.sent_at IS NULL AND e.suppressed_at IS NULL;
 -- Generic digests contain no message bodies or credentials; replace their recipient atomically.
 IF p_email IS NOT NULL THEN
 INSERT INTO public.email_outbox(id,kind,recipient_email,subject,text_body,template_data,related_workspace_id)
 SELECT gen_random_uuid(),e.kind,p_email,e.subject,e.text_body,e.template_data,wid FROM public.email_outbox e
 WHERE e.kind='message_digest' AND e.template_data->>'workspaceId'=wid::text AND e.template_data->>'clientId'=p_client::text
 AND e.sent_at IS NULL AND e.suppressed_at IS NULL;
 END IF;
 UPDATE public.email_outbox e SET suppressed_at=statement_timestamp(),text_body='[superseded]',template_data=CASE WHEN e.related_booking_id IS NULL THEN jsonb_build_object('workspaceId',wid,'clientId',p_client) ELSE '{}'::jsonb END
 WHERE e.sent_at IS NULL AND e.suppressed_at IS NULL AND (
 EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=e.related_booking_id AND b.workspace_id=wid AND b.client_id=p_client)
 OR (e.template_data->>'workspaceId'=wid::text AND e.template_data->>'clientId'=p_client::text AND e.recipient_email IS DISTINCT FROM p_email));
 DELETE FROM public.client_login_tokens WHERE workspace_id=wid AND client_id=p_client;
 DELETE FROM public.client_auth_sessions WHERE workspace_id=wid AND client_id=p_client;
 UPDATE public.booking_access_tokens t SET revoked_at=statement_timestamp() FROM public.bookings b
 WHERE t.booking_id=b.id AND t.workspace_id=b.workspace_id AND b.workspace_id=wid AND b.client_id=p_client AND t.revoked_at IS NULL;
 IF p_email IS NOT NULL THEN UPDATE public.bookings SET delivery_email_override=p_email WHERE workspace_id=wid AND client_id=p_client; END IF;
 RETURN jsonb_build_object('summaries',summaries,'followups',followups);
 END;
$$;
CREATE FUNCTION public.slotera_client_erase_context(p_client uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE wid uuid;
 BEGIN
 wid:=public.slotera_current_workspace_id();
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE workspace_id=wid AND id=p_client) THEN RETURN; END IF;
 DELETE FROM public.message_digest_runs WHERE workspace_id=wid AND actor_key='client:'||p_client;
 DELETE FROM public.client_login_tokens WHERE workspace_id=wid AND client_id=p_client;
 DELETE FROM public.client_auth_sessions WHERE workspace_id=wid AND client_id=p_client;
 DELETE FROM public.client_conversations WHERE workspace_id=wid AND client_id=p_client;
 DELETE FROM public.client_email_commands WHERE workspace_id=wid AND client_id=p_client;
 DELETE FROM public.booking_followups f USING public.bookings b WHERE f.workspace_id=wid AND b.workspace_id=wid AND f.booking_id=b.id AND b.client_id=p_client;
 DELETE FROM public.email_outbox WHERE template_data->>'workspaceId'=wid::text AND template_data->>'clientId'=p_client::text;
 END;
$$;
REVOKE ALL ON FUNCTION public.slotera_client_contact_prepare(uuid,text),public.slotera_client_erase_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slotera_client_contact_prepare(uuid,text),public.slotera_client_erase_context(uuid) TO slotera_app;

ALTER TABLE public.workspace_business_profiles ADD COLUMN notify_operator_messages boolean DEFAULT true NOT NULL;
ALTER TABLE public.email_outbox ADD COLUMN related_workspace_id uuid CONSTRAINT fk_email_outbox_related_workspace_id_workspaces REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX ix_email_outbox_client_context ON public.email_outbox((template_data->>'workspaceId'),(template_data->>'clientId'));
CREATE TABLE public.message_digest_runs (
 workspace_id uuid NOT NULL CONSTRAINT fk_message_digest_runs_workspace_id_workspaces REFERENCES public.workspaces(id) ON DELETE CASCADE,
 actor_key varchar(80) NOT NULL,
 digest_day date NOT NULL,
 CONSTRAINT pk_message_digest_runs PRIMARY KEY(workspace_id,actor_key,digest_day)
);
ALTER TABLE public.message_digest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_digest_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY message_digest_runs_tenant ON public.message_digest_runs USING(workspace_id=public.slotera_current_workspace_id()) WITH CHECK(workspace_id=public.slotera_current_workspace_id());
CREATE FUNCTION public.slotera_queue_message_digests(p_base text,p_now timestamptz DEFAULT statement_timestamp()) RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE recipient record; target record; message_count integer; queued integer:=0; copy_subject text; copy_body text;
 BEGIN
 FOR recipient IN
 SELECT c.workspace_id,c.id AS client_id,'client:'||c.id AS actor_key,'operator'::text AS sender_kind,c.email,c.preferred_language AS language,
 (p_now AT TIME ZONE w.timezone)::date AS local_day,w.slug,w.timezone
 FROM public.clients c JOIN public.workspaces w ON w.id=c.workspace_id
 WHERE c.erased_at IS NULL AND c.message_digest_enabled AND w.operational_status='active'
 AND extract(hour FROM p_now AT TIME ZONE w.timezone)>=9
 AND NOT EXISTS(SELECT 1 FROM public.message_digest_runs d WHERE d.workspace_id=c.workspace_id AND d.actor_key='client:'||c.id AND d.digest_day=(p_now AT TIME ZONE w.timezone)::date)
 AND EXISTS(SELECT 1 FROM public.conversation_messages m LEFT JOIN public.conversation_reads r ON r.workspace_id=m.workspace_id AND r.conversation_id=m.conversation_id AND r.actor_key='client:'||c.id WHERE m.workspace_id=c.workspace_id AND m.conversation_id=c.id AND m.sender_kind='operator' AND m.created_at<=((date_trunc('day',p_now AT TIME ZONE w.timezone)+interval '9 hours') AT TIME ZONE w.timezone) AND m.sequence>greatest(coalesce(r.last_read,0),coalesce(r.last_digest,0)))
 UNION ALL
 SELECT w.id,NULL::uuid,'operator:'||u.id,'client',u.email,u.preferred_language,
 (p_now AT TIME ZONE w.timezone)::date,w.slug,w.timezone
 FROM public.workspaces w JOIN public.workspace_memberships wm ON wm.workspace_id=w.id
 JOIN public.users u ON u.id=wm.user_id JOIN public.workspace_business_profiles bp ON bp.workspace_id=w.id
 WHERE w.operational_status='active' AND bp.notify_operator_messages
 AND extract(hour FROM p_now AT TIME ZONE w.timezone)>=9
 AND NOT EXISTS(SELECT 1 FROM public.message_digest_runs d WHERE d.workspace_id=w.id AND d.actor_key='operator:'||u.id AND d.digest_day=(p_now AT TIME ZONE w.timezone)::date)
 AND EXISTS(SELECT 1 FROM public.conversation_messages m LEFT JOIN public.conversation_reads r ON r.workspace_id=m.workspace_id AND r.conversation_id=m.conversation_id AND r.actor_key='operator:'||u.id WHERE m.workspace_id=w.id AND m.sender_kind='client' AND m.created_at<=((date_trunc('day',p_now AT TIME ZONE w.timezone)+interval '9 hours') AT TIME ZONE w.timezone) AND m.sequence>greatest(coalesce(r.last_read,0),coalesce(r.last_digest,0)))
 ORDER BY 1,3 LIMIT 100
 LOOP
 PERFORM pg_advisory_xact_lock(hashtextextended('slotera:scheduling:'||recipient.workspace_id,0));
 -- Match the same Client -> conversation order used by message/read/erasure writes.
 FOR target IN SELECT c.id FROM public.clients c WHERE c.workspace_id=recipient.workspace_id AND c.erased_at IS NULL AND (recipient.client_id IS NULL OR c.id=recipient.client_id) ORDER BY c.id FOR UPDATE
 LOOP
 PERFORM 1 FROM public.client_conversations WHERE workspace_id=recipient.workspace_id AND client_id=target.id FOR UPDATE;
 END LOOP;
 IF recipient.client_id IS NOT NULL THEN
 SELECT email,preferred_language INTO recipient.email,recipient.language FROM public.clients WHERE workspace_id=recipient.workspace_id AND id=recipient.client_id AND erased_at IS NULL AND message_digest_enabled;
 IF NOT FOUND THEN CONTINUE; END IF;
 ELSE
 IF NOT EXISTS(SELECT 1 FROM public.workspace_business_profiles WHERE workspace_id=recipient.workspace_id AND notify_operator_messages) THEN CONTINUE; END IF;
 END IF;
 SELECT count(*) INTO message_count FROM public.conversation_messages m
 JOIN public.clients cl ON cl.workspace_id=m.workspace_id AND cl.id=m.conversation_id AND cl.erased_at IS NULL
 LEFT JOIN public.conversation_reads r ON r.workspace_id=m.workspace_id AND r.conversation_id=m.conversation_id AND r.actor_key=recipient.actor_key
 WHERE m.workspace_id=recipient.workspace_id AND (recipient.client_id IS NULL OR m.conversation_id=recipient.client_id)
 AND m.sender_kind=recipient.sender_kind AND m.created_at<=((date_trunc('day',p_now AT TIME ZONE recipient.timezone)+interval '9 hours') AT TIME ZONE recipient.timezone) AND m.sequence>greatest(coalesce(r.last_read,0),coalesce(r.last_digest,0));
 IF message_count=0 THEN CONTINUE; END IF;
 INSERT INTO public.message_digest_runs(workspace_id,actor_key,digest_day) VALUES(recipient.workspace_id,recipient.actor_key,recipient.local_day) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN CONTINUE; END IF;
 INSERT INTO public.conversation_reads(workspace_id,conversation_id,actor_key,last_digest)
 SELECT m.workspace_id,m.conversation_id,recipient.actor_key,max(m.sequence) FROM public.conversation_messages m
 WHERE m.workspace_id=recipient.workspace_id AND (recipient.client_id IS NULL OR m.conversation_id=recipient.client_id) AND m.sender_kind=recipient.sender_kind AND m.created_at<=((date_trunc('day',p_now AT TIME ZONE recipient.timezone)+interval '9 hours') AT TIME ZONE recipient.timezone) GROUP BY m.workspace_id,m.conversation_id
 ON CONFLICT(workspace_id,conversation_id,actor_key) DO UPDATE SET last_digest=greatest(conversation_reads.last_digest,EXCLUDED.last_digest);
 INSERT INTO public.email_outbox(id,kind,recipient_email,subject,text_body,template_data,related_workspace_id)
 VALUES(gen_random_uuid(),'message_digest',recipient.email,'Message digest',rtrim(p_base,'/')||CASE WHEN recipient.client_id IS NULL THEN '/admin/messages' ELSE '/client/'||recipient.slug END,
 jsonb_build_object('workspaceId',recipient.workspace_id,'clientId',recipient.client_id,'actorKey',recipient.actor_key,'senderKind',recipient.sender_kind,'language',recipient.language),recipient.workspace_id);
 queued:=queued+1;
 END LOOP;
 RETURN queued;
 END;
$$;
CREATE FUNCTION public.slotera_client_mail_eligible(p_id uuid) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE item public.email_outbox%ROWTYPE; cl public.clients%ROWTYPE; wid uuid;
 BEGIN
 SELECT * INTO item FROM public.email_outbox WHERE id=p_id;
 IF item.kind NOT IN ('client_sign_in','message_digest','booking_followup') THEN RETURN true; END IF;
 IF item.kind='booking_followup' THEN
 SELECT c.* INTO cl FROM public.clients c JOIN public.bookings b ON b.workspace_id=c.workspace_id AND b.client_id=c.id WHERE b.id=item.related_booking_id AND b.status='completed';
 RETURN FOUND AND cl.erased_at IS NULL AND (coalesce((item.template_data->>'manual')::boolean,false) OR cl.automatic_followup_enabled);
 END IF;
 wid:=(item.template_data->>'workspaceId')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=wid AND operational_status='active') THEN RETURN false; END IF;
 IF item.template_data->>'clientId' IS NOT NULL THEN
 SELECT * INTO cl FROM public.clients WHERE workspace_id=wid AND id=(item.template_data->>'clientId')::uuid AND erased_at IS NULL;
 IF NOT FOUND THEN RETURN false; END IF;
 IF item.kind='client_sign_in' THEN RETURN EXISTS(SELECT 1 FROM public.client_login_tokens WHERE workspace_id=wid AND client_id=cl.id AND expires_at>statement_timestamp()); END IF;
 IF NOT cl.message_digest_enabled THEN RETURN false; END IF;
 ELSE
 IF NOT EXISTS(SELECT 1 FROM public.workspace_business_profiles WHERE workspace_id=wid AND notify_operator_messages) THEN RETURN false; END IF;
 END IF;
 RETURN EXISTS(SELECT 1 FROM public.conversation_messages m JOIN public.conversation_reads r ON r.workspace_id=m.workspace_id AND r.conversation_id=m.conversation_id AND r.actor_key=item.template_data->>'actorKey'
 WHERE m.workspace_id=wid AND (item.template_data->>'clientId' IS NULL OR m.conversation_id=(item.template_data->>'clientId')::uuid)
 AND m.sender_kind=item.template_data->>'senderKind' AND m.sequence>r.last_read AND m.sequence<=r.last_digest);
 END;
$$;
CREATE FUNCTION public.slotera_client_auth_maintenance() RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE n integer; m integer;
 BEGIN
 DELETE FROM public.client_login_tokens WHERE id IN(SELECT id FROM public.client_login_tokens WHERE expires_at<statement_timestamp() ORDER BY expires_at LIMIT 1000);
 GET DIAGNOSTICS n=ROW_COUNT;
 DELETE FROM public.client_auth_sessions WHERE id IN(SELECT id FROM public.client_auth_sessions WHERE expires_at<statement_timestamp() ORDER BY expires_at LIMIT 1000);
 GET DIAGNOSTICS m=ROW_COUNT;
 RETURN n+m;
 END;
$$;
REVOKE ALL ON FUNCTION public.slotera_queue_message_digests(text,timestamptz),public.slotera_client_mail_eligible(uuid),public.slotera_client_auth_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slotera_queue_message_digests(text,timestamptz),public.slotera_client_auth_maintenance() TO slotera_app;

CREATE FUNCTION public.slotera_followup_delivery(p_booking uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,public AS $$
 DECLARE item public.email_outbox%ROWTYPE;
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.bookings WHERE id=p_booking AND workspace_id=public.slotera_current_workspace_id()) THEN RETURN NULL; END IF;
 SELECT * INTO item FROM public.email_outbox WHERE related_booking_id=p_booking AND kind='booking_followup' ORDER BY created_at DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('pending',false,'status',NULL); END IF;
 RETURN jsonb_build_object('pending',item.sent_at IS NULL AND item.suppressed_at IS NULL,'manual',coalesce((item.template_data->>'manual')::boolean,false),
 'status',CASE WHEN item.suppressed_at IS NOT NULL THEN 'superseded' WHEN item.sent_at IS NOT NULL THEN 'sent' WHEN item.claimed_at IS NOT NULL THEN 'sending' WHEN item.attempt_count>=10 THEN 'failed' WHEN item.attempt_count>0 THEN 'retrying' ELSE 'queued' END);
 END;
$$;
REVOKE ALL ON FUNCTION public.slotera_followup_delivery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slotera_followup_delivery(uuid) TO slotera_app;

-- Owner defaults apply to newly created tables too; capabilities alone own credentials
-- and conversation writes. Tenant projections are read-only to the application role.
REVOKE ALL ON public.client_login_tokens,public.client_auth_sessions,
 public.client_conversations,public.conversation_messages,public.conversation_reads,
 public.message_digest_runs,public.client_email_commands FROM slotera_app;
GRANT SELECT ON public.client_conversations,public.conversation_messages,public.conversation_reads TO slotera_app;
GRANT SELECT,INSERT,DELETE ON public.client_email_commands TO slotera_app;
REVOKE UPDATE ON public.session_command_idempotency FROM slotera_app;

SET search_path = public;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE ai_documents (
	id UUID NOT NULL, 
	workspace_id UUID NOT NULL, 
	client_id UUID, 
	kind VARCHAR(40) NOT NULL, 
	source_id UUID NOT NULL, 
	position INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	content TEXT NOT NULL, 
	href VARCHAR(300) NOT NULL, 
	embedding VECTOR(1536) NOT NULL, 
	CONSTRAINT pk_ai_documents PRIMARY KEY (id), 
	CONSTRAINT uq_ai_documents_workspace_id UNIQUE (workspace_id, kind, source_id, position), 
	CONSTRAINT fk_ai_documents_workspace_id_workspaces FOREIGN KEY(workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
 CONSTRAINT fk_ai_documents_workspace_id_clients FOREIGN KEY(workspace_id,client_id) REFERENCES clients(workspace_id,id) ON DELETE CASCADE
)

;
CREATE INDEX ix_ai_documents_workspace_id ON ai_documents (workspace_id);

CREATE TABLE ai_jobs (
	id UUID NOT NULL, 
	workspace_id UUID NOT NULL, 
	kind VARCHAR(40) NOT NULL, 
	source_id UUID NOT NULL, 
	revision BIGINT DEFAULT 1 NOT NULL, 
	attempts INTEGER DEFAULT 0 NOT NULL, 
	due_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	claimed_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_ai_jobs PRIMARY KEY (id), 
	CONSTRAINT uq_ai_jobs_workspace_id UNIQUE (workspace_id, kind, source_id), 
	CONSTRAINT fk_ai_jobs_workspace_id_workspaces FOREIGN KEY(workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_ai_jobs_due_at ON ai_jobs (due_at);

CREATE TABLE ai_source_revisions (
	id BIGSERIAL NOT NULL, 
	transaction_id BIGINT DEFAULT txid_current() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL, 
	workspace_id UUID NOT NULL, 
	CONSTRAINT pk_ai_source_revisions PRIMARY KEY (id), 
	CONSTRAINT fk_ai_source_revisions_workspace_id_workspaces FOREIGN KEY(workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_ai_source_revisions_workspace_id ON ai_source_revisions (workspace_id, id);

CREATE TABLE ai_states (
	workspace_id UUID NOT NULL, 
	enabled BOOLEAN DEFAULT false NOT NULL, 
	revision BIGINT DEFAULT 1 NOT NULL, 
	privacy_epoch BIGINT DEFAULT 1 NOT NULL, 
	CONSTRAINT pk_ai_states PRIMARY KEY (workspace_id), 
	CONSTRAINT fk_ai_states_workspace_id_workspaces FOREIGN KEY(workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
)

;

CREATE TABLE ai_threads (
	kind VARCHAR(20) DEFAULT 'chat' NOT NULL,
	id UUID NOT NULL, 
	workspace_id UUID NOT NULL, 
	actor_id UUID NOT NULL, 
	title VARCHAR(120) NOT NULL,
	title_generated BOOLEAN DEFAULT false NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_ai_threads PRIMARY KEY (id), 
	CONSTRAINT uq_ai_threads_tenant_id UNIQUE (workspace_id, id), 
	CONSTRAINT fk_ai_threads_workspace_id_workspaces FOREIGN KEY(workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE, 
	CONSTRAINT fk_ai_threads_actor_id_users FOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_ai_threads_owner ON ai_threads (workspace_id, actor_id, created_at);

CREATE TABLE ai_usage (
	workspace_id UUID NOT NULL, 
	day DATE NOT NULL, 
	answers INTEGER DEFAULT 0 NOT NULL, 
	tokens INTEGER DEFAULT 0 NOT NULL, 
	indexing_tokens INTEGER DEFAULT 0 NOT NULL, 
	CONSTRAINT pk_ai_usage PRIMARY KEY (workspace_id, day), 
	CONSTRAINT fk_ai_usage_workspace_id_workspaces FOREIGN KEY(workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
)

;

CREATE TABLE ai_turns (
	id UUID NOT NULL, 
	workspace_id UUID NOT NULL, 
	actor_id UUID NOT NULL, 
	thread_id UUID NOT NULL, 
	key VARCHAR(255) NOT NULL, 
	fingerprint VARCHAR(64) NOT NULL, 
	prompt TEXT NOT NULL, 
	answer TEXT DEFAULT '' NOT NULL, 
	language VARCHAR(2) NOT NULL, 
	status VARCHAR(20) DEFAULT 'pending' NOT NULL, 
	privacy_epoch BIGINT NOT NULL, 
	citations JSONB DEFAULT '[]'::jsonb NOT NULL, 
	proposal JSONB, 
	error_code VARCHAR(50), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_ai_turns PRIMARY KEY (id), 
	CONSTRAINT uq_ai_turns_workspace_id UNIQUE (workspace_id, actor_id, key), 
	CONSTRAINT uq_ai_turns_tenant_id UNIQUE (workspace_id, id), 
	CONSTRAINT fk_ai_turns_workspace_id_ai_threads FOREIGN KEY(workspace_id, thread_id) REFERENCES ai_threads (workspace_id, id) ON DELETE CASCADE, 
	CONSTRAINT fk_ai_turns_workspace_id_workspaces FOREIGN KEY(workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE, 
	CONSTRAINT fk_ai_turns_actor_id_users FOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_ai_turns_thread ON ai_turns (workspace_id, thread_id, created_at);

CREATE TABLE ai_briefings (
	id UUID NOT NULL, 
	workspace_id UUID NOT NULL, 
	actor_id UUID NOT NULL, 
	scope VARCHAR(80) NOT NULL, 
	language VARCHAR(2) NOT NULL, 
	turn_id UUID NOT NULL, 
	generated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_ai_briefings PRIMARY KEY (id), 
	CONSTRAINT uq_ai_briefings_workspace_id UNIQUE (workspace_id, actor_id, scope), 
	CONSTRAINT fk_ai_briefings_workspace_id_ai_turns FOREIGN KEY(workspace_id, turn_id) REFERENCES ai_turns (workspace_id, id) ON DELETE CASCADE, 
	CONSTRAINT fk_ai_briefings_workspace_id_workspaces FOREIGN KEY(workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE, 
	CONSTRAINT fk_ai_briefings_actor_id_users FOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE CASCADE
)

;
ALTER TABLE ai_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_briefings FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_briefings_tenant ON ai_briefings USING(workspace_id=slotera_current_workspace_id()) WITH CHECK(workspace_id=slotera_current_workspace_id());
REVOKE ALL ON ai_briefings FROM slotera_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ai_briefings TO slotera_app;
ALTER TABLE ai_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_documents_tenant ON ai_documents USING(workspace_id=slotera_current_workspace_id()) WITH CHECK(workspace_id=slotera_current_workspace_id());
REVOKE ALL ON ai_documents FROM slotera_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ai_documents TO slotera_app;
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_jobs_tenant ON ai_jobs USING(workspace_id=slotera_current_workspace_id()) WITH CHECK(workspace_id=slotera_current_workspace_id());
REVOKE ALL ON ai_jobs FROM slotera_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ai_jobs TO slotera_app;
ALTER TABLE ai_source_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_source_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_source_revisions_tenant ON ai_source_revisions USING(workspace_id=slotera_current_workspace_id()) WITH CHECK(workspace_id=slotera_current_workspace_id());
REVOKE ALL ON ai_source_revisions FROM slotera_app;
GRANT SELECT ON ai_source_revisions TO slotera_app;
ALTER TABLE ai_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_states FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_states_tenant ON ai_states USING(workspace_id=slotera_current_workspace_id()) WITH CHECK(workspace_id=slotera_current_workspace_id());
REVOKE ALL ON ai_states FROM slotera_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ai_states TO slotera_app;
ALTER TABLE ai_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_threads FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_threads_tenant ON ai_threads USING(workspace_id=slotera_current_workspace_id()) WITH CHECK(workspace_id=slotera_current_workspace_id());
REVOKE ALL ON ai_threads FROM slotera_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ai_threads TO slotera_app;
ALTER TABLE ai_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_turns FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_turns_tenant ON ai_turns USING(workspace_id=slotera_current_workspace_id()) WITH CHECK(workspace_id=slotera_current_workspace_id());
REVOKE ALL ON ai_turns FROM slotera_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ai_turns TO slotera_app;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_tenant ON ai_usage USING(workspace_id=slotera_current_workspace_id()) WITH CHECK(workspace_id=slotera_current_workspace_id());
REVOKE ALL ON ai_usage FROM slotera_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ai_usage TO slotera_app;
CREATE INDEX ix_ai_documents_words ON ai_documents USING gin(to_tsvector('simple',content));
CREATE FUNCTION slotera_ai_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE wid uuid; sid uuid;
BEGIN
 wid:=coalesce((to_jsonb(NEW)->>'workspace_id')::uuid,(to_jsonb(OLD)->>'workspace_id')::uuid,(to_jsonb(NEW)->>'id')::uuid,(to_jsonb(OLD)->>'id')::uuid);
 sid:=coalesce((to_jsonb(NEW)->>'id')::uuid,(to_jsonb(OLD)->>'id')::uuid,wid);
 IF NOT EXISTS(SELECT 1 FROM workspaces WHERE id=wid) THEN RETURN coalesce(NEW,OLD); END IF;
 IF EXISTS(SELECT 1 FROM ai_states WHERE workspace_id=wid AND enabled) THEN
 INSERT INTO ai_source_revisions(workspace_id) VALUES(wid);
 END IF;
 IF TG_TABLE_NAME='clients' AND TG_OP='UPDATE' AND (to_jsonb(NEW)->>'erased_at') IS NOT NULL AND (to_jsonb(OLD)->>'erased_at') IS NULL THEN
  UPDATE ai_states SET privacy_epoch=privacy_epoch+1 WHERE workspace_id=wid;
  DELETE FROM ai_threads WHERE workspace_id=wid;
  DELETE FROM ai_documents WHERE workspace_id=wid AND client_id=sid;
  UPDATE ai_jobs SET revision=revision+1,attempts=0,claimed_at=NULL,due_at=statement_timestamp() WHERE workspace_id=wid;
 END IF;
 IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('client_notes','conversation_messages','booking_form_responses') THEN
 UPDATE ai_states SET privacy_epoch=privacy_epoch+1 WHERE workspace_id=wid;
 DELETE FROM ai_threads WHERE workspace_id=wid;
 END IF;
 IF TG_OP='DELETE' THEN DELETE FROM ai_jobs WHERE workspace_id=wid AND kind=TG_TABLE_NAME AND source_id=sid; END IF;
 IF TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM ai_states WHERE workspace_id=wid AND enabled)
 AND TG_TABLE_NAME IN ('client_notes','conversation_messages','booking_form_responses','services','service_packages','sessions') THEN
 INSERT INTO ai_jobs(id,workspace_id,kind,source_id) VALUES(gen_random_uuid(),wid,TG_TABLE_NAME,sid)
 ON CONFLICT(workspace_id,kind,source_id) DO UPDATE SET revision=ai_jobs.revision+1,attempts=0,due_at=statement_timestamp(),claimed_at=NULL;
 END IF;
 DELETE FROM ai_documents WHERE workspace_id=wid AND kind=TG_TABLE_NAME AND source_id=sid;
 RETURN coalesce(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION slotera_ai_changed() FROM PUBLIC;
CREATE FUNCTION slotera_ai_claim() RETURNS TABLE(id uuid,workspace_id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 UPDATE ai_jobs j SET claimed_at=statement_timestamp(),attempts=attempts+1
 WHERE j.id=(SELECT x.id FROM ai_jobs x JOIN ai_states a ON a.workspace_id=x.workspace_id JOIN workspaces w ON w.id=x.workspace_id WHERE a.enabled AND w.operational_status='active' AND x.attempts<5 AND x.due_at<=statement_timestamp() AND (x.claimed_at IS NULL OR x.claimed_at<statement_timestamp()-interval '2 minutes') ORDER BY x.due_at,x.id FOR UPDATE OF x SKIP LOCKED LIMIT 1)
 RETURNING j.id,j.workspace_id;
$$;
REVOKE ALL ON FUNCTION slotera_ai_claim() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION slotera_ai_claim() TO slotera_app;
CREATE FUNCTION slotera_ai_close() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.operational_status='suspended' THEN
 UPDATE ai_states SET enabled=false,privacy_epoch=privacy_epoch+1 WHERE workspace_id=NEW.id;
 DELETE FROM ai_threads WHERE workspace_id=NEW.id;
 DELETE FROM ai_documents WHERE workspace_id=NEW.id;
 DELETE FROM ai_jobs WHERE workspace_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION slotera_ai_close() FROM PUBLIC;
CREATE TRIGGER ai_workspace_close AFTER UPDATE OF operational_status ON workspaces FOR EACH ROW EXECUTE FUNCTION slotera_ai_close();
CREATE TRIGGER ai_change AFTER UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION slotera_ai_changed();
CREATE TRIGGER ai_change AFTER INSERT OR UPDATE OR DELETE ON workspace_business_profiles FOR EACH ROW EXECUTE FUNCTION slotera_ai_changed();
CREATE TRIGGER ai_change AFTER INSERT OR UPDATE OR DELETE ON workspace_payment_settings FOR EACH ROW EXECUTE FUNCTION slotera_ai_changed();
CREATE TRIGGER ai_change AFTER INSERT OR UPDATE OR DELETE ON clients FOR EACH ROW EXECUTE FUNCTION slotera_ai_changed();
CREATE TRIGGER ai_change AFTER INSERT OR UPDATE OR DELETE ON client_notes FOR EACH ROW EXECUTE FUNCTION slotera_ai_changed();
CREATE TRIGGER ai_change AFTER INSERT OR UPDATE OR DELETE ON conversation_messages FOR EACH ROW EXECUTE FUNCTION slotera_ai_changed();
CREATE TRIGGER ai_change AFTER INSERT OR UPDATE OR DELETE ON booking_form_responses FOR EACH ROW EXECUTE FUNCTION slotera_ai_changed();
CREATE TRIGGER ai_change AFTER INSERT OR UPDATE OR DELETE ON services FOR EACH ROW EXECUTE FUNCTION slotera_ai_changed();
CREATE TRIGGER ai_change AFTER INSERT OR UPDATE OR DELETE ON service_packages FOR EACH ROW EXECUTE FUNCTION slotera_ai_changed();
CREATE TRIGGER ai_change AFTER INSERT OR UPDATE OR DELETE ON sessions FOR EACH ROW EXECUTE FUNCTION slotera_ai_changed();
CREATE TRIGGER ai_change AFTER INSERT OR UPDATE OR DELETE ON bookings FOR EACH ROW EXECUTE FUNCTION slotera_ai_changed();
CREATE TRIGGER ai_change AFTER INSERT OR UPDATE OR DELETE ON session_action_items FOR EACH ROW EXECUTE FUNCTION slotera_ai_changed();

CREATE FUNCTION slotera_ai_cleanup() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
 DELETE FROM ai_turns WHERE id IN(SELECT id FROM ai_turns WHERE created_at<statement_timestamp()-interval '30 days' ORDER BY created_at LIMIT 1000);
 GET DIAGNOSTICS n=ROW_COUNT;
 DELETE FROM ai_threads WHERE id IN(SELECT t.id FROM ai_threads t WHERE t.created_at<statement_timestamp()-interval '30 days' AND NOT EXISTS(SELECT 1 FROM ai_turns r WHERE r.thread_id=t.id) LIMIT 1000);
 DELETE FROM ai_usage WHERE day<current_date-31;
 DELETE FROM ai_source_revisions WHERE id IN(SELECT r.id FROM ai_source_revisions r WHERE r.created_at<clock_timestamp()-interval '30 days' LIMIT 1000);
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION slotera_ai_cleanup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION slotera_ai_cleanup() TO slotera_app;

-- Notification retention: read notifications go after 30 days, unread ones after 90.
-- The runtime role still cannot delete notifications itself; maintenance calls this.
CREATE FUNCTION slotera_notification_retention() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
 DELETE FROM notifications WHERE id IN(
  SELECT id FROM notifications
  WHERE (read_at IS NOT NULL AND occurred_at<statement_timestamp()-interval '30 days')
     OR occurred_at<statement_timestamp()-interval '90 days'
  ORDER BY occurred_at LIMIT 5000);
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION slotera_notification_retention() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION slotera_notification_retention() TO slotera_app;

-- Package sales. The operator records a sale (the client pays outside Slotera); each
-- purchase snapshots the package's items, one per session the client may book. A live
-- booking holds one item, and a cancelled one gives it back by leaving the partial index.
-- Purchases are voided, never deleted, so the runtime role cannot delete them.
CREATE TABLE public.package_purchases (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    client_id uuid NOT NULL,
    package_id uuid NOT NULL,
    package_name_snapshot character varying(160) NOT NULL,
    price_cents integer NOT NULL,
    currency character varying(3) NOT NULL,
    payment_status character varying(8) NOT NULL,
    payment_received_at timestamp with time zone,
    status character varying(8) NOT NULL,
    voided_at timestamp with time zone,
    notes character varying(2000),
    version bigint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT package_purchases_pkey PRIMARY KEY (id),
    CONSTRAINT package_purchases_workspace_id_id_key UNIQUE (workspace_id, id),
    CONSTRAINT package_purchases_price_check CHECK (price_cents >= 0),
    CONSTRAINT package_purchases_currency_check CHECK (char_length(currency) = 3),
    CONSTRAINT package_purchases_payment_status_check CHECK (payment_status IN ('pending', 'paid')),
    CONSTRAINT package_purchases_paid_at_check CHECK ((payment_status = 'paid') = (payment_received_at IS NOT NULL)),
    CONSTRAINT package_purchases_status_check CHECK (status IN ('active', 'voided')),
    CONSTRAINT package_purchases_voided_at_check CHECK ((status = 'voided') = (voided_at IS NOT NULL)),
    CONSTRAINT package_purchases_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
    CONSTRAINT package_purchases_workspace_id_client_id_fkey FOREIGN KEY (workspace_id, client_id) REFERENCES public.clients(workspace_id, id) ON DELETE RESTRICT,
    CONSTRAINT package_purchases_workspace_id_package_id_fkey FOREIGN KEY (workspace_id, package_id) REFERENCES public.service_packages(workspace_id, id) ON DELETE RESTRICT
);
CREATE INDEX ix_package_purchases_workspace_client ON public.package_purchases (workspace_id, client_id, created_at DESC, id);
CREATE INDEX ix_package_purchases_workspace_package ON public.package_purchases (workspace_id, package_id);

CREATE TABLE public.package_purchase_items (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    purchase_id uuid NOT NULL,
    service_id uuid NOT NULL,
    "position" integer NOT NULL,
    title_snapshot character varying(160) NOT NULL,
    CONSTRAINT package_purchase_items_pkey PRIMARY KEY (id),
    CONSTRAINT package_purchase_items_position_key UNIQUE (workspace_id, purchase_id, "position"),
    CONSTRAINT package_purchase_items_position_check CHECK ("position" >= 0),
    CONSTRAINT package_purchase_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
    CONSTRAINT package_purchase_items_purchase_fkey FOREIGN KEY (workspace_id, purchase_id) REFERENCES public.package_purchases(workspace_id, id) ON DELETE CASCADE,
    CONSTRAINT package_purchase_items_service_fkey FOREIGN KEY (workspace_id, service_id) REFERENCES public.services(workspace_id, id) ON DELETE RESTRICT
);

ALTER TABLE public.bookings
    ADD COLUMN package_purchase_id uuid,
    ADD COLUMN package_position integer,
    ADD CONSTRAINT bookings_package_pair_check CHECK ((package_purchase_id IS NULL) = (package_position IS NULL)),
    ADD CONSTRAINT bookings_package_method_check CHECK ((payment_method = 'package') = (package_purchase_id IS NOT NULL)),
    ADD CONSTRAINT bookings_package_item_fkey FOREIGN KEY (workspace_id, package_purchase_id, package_position)
        REFERENCES public.package_purchase_items(workspace_id, purchase_id, "position") ON DELETE RESTRICT;
-- The double-spend guard: one live booking per package item.
CREATE UNIQUE INDEX ux_bookings_live_package_item ON public.bookings (workspace_id, package_purchase_id, package_position)
    WHERE package_purchase_id IS NOT NULL AND status <> 'cancelled';

ALTER TABLE public.package_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_purchases FORCE ROW LEVEL SECURITY;
CREATE POLICY package_purchases_tenant ON public.package_purchases TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));
ALTER TABLE public.package_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_purchase_items FORCE ROW LEVEL SECURITY;
CREATE POLICY package_purchase_items_tenant ON public.package_purchase_items TO slotera_app USING ((workspace_id = public.slotera_current_workspace_id())) WITH CHECK ((workspace_id = public.slotera_current_workspace_id()));
GRANT SELECT,INSERT,UPDATE ON TABLE public.package_purchases TO slotera_app;
GRANT SELECT,INSERT ON TABLE public.package_purchase_items TO slotera_app;

SET search_path = public;
SET row_security = on;
SET check_function_bodies = on;
"""


def upgrade() -> None:
    if op.get_context().as_sql:
        op.execute(SCHEMA_SQL)
        return
    connection = op.get_bind().connection.dbapi_connection
    assert connection is not None
    connection.run_async(lambda driver: driver.execute(SCHEMA_SQL))


def downgrade() -> None:
    # Alembic still needs its version table after the application objects are removed.
    op.execute("DROP EXTENSION IF EXISTS btree_gist CASCADE")
    op.execute("""
        DO $$ DECLARE obj record; BEGIN
          FOR obj IN SELECT tablename FROM pg_tables
            WHERE schemaname = 'public' AND tablename <> 'alembic_version'
          LOOP EXECUTE format('DROP TABLE public.%I CASCADE', obj.tablename); END LOOP;
          FOR obj IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
          LOOP EXECUTE format('DROP FUNCTION %s CASCADE', obj.signature); END LOOP;
          FOR obj IN SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
            WHERE n.nspname='public' AND t.typtype='e'
          LOOP EXECUTE format('DROP TYPE public.%I CASCADE', obj.typname); END LOOP;
        END $$;
    """)
