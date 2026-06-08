import { describe, it, expect, beforeEach } from 'vitest';
import { CeleryTaskGenerator } from '../../../src/templates/backend/python-celery-tasks';

describe('CeleryTaskGenerator', () => {
  let generator: CeleryTaskGenerator;

  beforeEach(() => {
    generator = new CeleryTaskGenerator();
  });

  describe('generateCeleryConfig', () => {
    it('should generate basic Celery configuration', () => {
      const config = {
        framework: 'fastapi'
      };

      const files = generator.generateCeleryConfig(config);

      expect(files).toHaveLength(10);
      expect(files.map(f => f.path)).toContain('celery_app.py');
      expect(files.map(f => f.path)).toContain('tasks/__init__.py');
      expect(files.map(f => f.path)).toContain('tasks/email_tasks.py');
      expect(files.map(f => f.path)).toContain('tasks/data_tasks.py');
      expect(files.map(f => f.path)).toContain('tasks/notification_tasks.py');
      expect(files.map(f => f.path)).toContain('worker.py');
      expect(files.map(f => f.path)).toContain('tasks/monitoring.py');
      expect(files.map(f => f.path)).toContain('docker/celery.dockerfile');
      expect(files.map(f => f.path)).toContain('config/supervisor/celery.conf');
    });

    it('should include scheduled tasks when enabled', () => {
      const config = {
        framework: 'django',
        enableScheduling: true
      };

      const files = generator.generateCeleryConfig(config);

      expect(files).toHaveLength(11);
      expect(files.map(f => f.path)).toContain('tasks/scheduled.py');
    });

    it('should generate framework-specific imports', () => {
      const frameworks = ['fastapi', 'django', 'flask', 'tornado', 'sanic'];

      frameworks.forEach(framework => {
        const config = { framework };
        const files = generator.generateCeleryConfig(config);
        const celeryApp = files.find(f => f.path === 'celery_app.py');

        expect(celeryApp).toBeDefined();
        
        if (framework === 'fastapi') {
          expect(celeryApp!.content).toContain('from fastapi import FastAPI');
          expect(celeryApp!.content).toContain('from sqlalchemy.ext.asyncio import AsyncSession');
        } else if (framework === 'django') {
          expect(celeryApp!.content).toContain('from django.conf import settings');
          expect(celeryApp!.content).toContain('from django.db import connection');
        } else if (framework === 'flask') {
          expect(celeryApp!.content).toContain('from flask import Flask, current_app');
          expect(celeryApp!.content).toContain('from flask_sqlalchemy import SQLAlchemy');
        } else if (framework === 'tornado') {
          expect(celeryApp!.content).toContain('import tornado.ioloop');
          expect(celeryApp!.content).toContain('from tornado import gen');
        } else if (framework === 'sanic') {
          expect(celeryApp!.content).toContain('from sanic import Sanic');
          expect(celeryApp!.content).toContain('from sanic.response import json as sanic_json');
        }
      });
    });

    it('should include task routing when enabled', () => {
      const config = {
        framework: 'fastapi',
        enableRouting: true
      };

      const files = generator.generateCeleryConfig(config);
      const celeryApp = files.find(f => f.path === 'celery_app.py');

      expect(celeryApp!.content).toContain('# Task routing configuration');
      expect(celeryApp!.content).toContain('app.conf.task_routes');
      expect(celeryApp!.content).toContain("'tasks.email_tasks.*': {'queue': 'emails'}");
      expect(celeryApp!.content).toContain("'tasks.data_tasks.*': {'queue': 'data_processing'}");
    });

    it('should include result backend when enabled', () => {
      const config = {
        framework: 'django',
        enableResultBackend: true
      };

      const files = generator.generateCeleryConfig(config);
      const celeryApp = files.find(f => f.path === 'celery_app.py');

      expect(celeryApp!.content).toContain('# Result backend configuration');
      expect(celeryApp!.content).toContain("app.conf.result_backend = 'redis://localhost:6379/1'");
      expect(celeryApp!.content).toContain('app.conf.result_expires = 3600');
      expect(celeryApp!.content).toContain('app.conf.result_persistent = True');
    });

    it('should include monitoring signals when enabled', () => {
      const config = {
        framework: 'flask',
        enableMonitoring: true
      };

      const files = generator.generateCeleryConfig(config);
      const celeryApp = files.find(f => f.path === 'celery_app.py');

      expect(celeryApp!.content).toContain('# Monitoring signal handlers');
      expect(celeryApp!.content).toContain('@task_prerun.connect');
      expect(celeryApp!.content).toContain('@task_postrun.connect');
      expect(celeryApp!.content).toContain('@task_failure.connect');
      expect(celeryApp!.content).toContain('monitor_task_performance.delay');
    });

    it('should include priority settings when enabled', () => {
      const config = {
        framework: 'fastapi',
        enablePriority: true
      };

      const files = generator.generateCeleryConfig(config);
      const celeryApp = files.find(f => f.path === 'celery_app.py');

      expect(celeryApp!.content).toContain('task_inherit_parent_priority=True');
      expect(celeryApp!.content).toContain('task_default_priority=5');
      expect(celeryApp!.content).toContain('task_queue_max_priority=10');
    });

    it('should include retry configuration when enabled', () => {
      const config = {
        framework: 'django',
        enableRetries: true
      };

      const files = generator.generateCeleryConfig(config);
      const emailTasks = files.find(f => f.path === 'tasks/email_tasks.py');

      expect(emailTasks!.content).toContain('autoretry_for=(Exception,)');
      expect(emailTasks!.content).toContain('retry_kwargs={"max_retries": 5}');
    });
  });

  describe('Email Tasks', () => {
    it('should generate comprehensive email tasks', () => {
      const config = { framework: 'fastapi' };
      const files = generator.generateCeleryConfig(config);
      const emailTasks = files.find(f => f.path === 'tasks/email_tasks.py');

      expect(emailTasks).toBeDefined();
      expect(emailTasks!.content).toContain('@app.task(bind=True, queue=\'emails\', priority=8)');
      expect(emailTasks!.content).toContain('def send_email(');
      expect(emailTasks!.content).toContain('def send_bulk_emails(');
      expect(emailTasks!.content).toContain('def process_email_batch(');
      expect(emailTasks!.content).toContain('def send_notification_email(');
      expect(emailTasks!.content).toContain('def send_transactional_email(');
    });

    it('should include email validation and error handling', () => {
      const config = { framework: 'django' };
      const files = generator.generateCeleryConfig(config);
      const emailTasks = files.find(f => f.path === 'tasks/email_tasks.py');

      expect(emailTasks!.content).toContain('response.raise_for_status()');
      expect(emailTasks!.content).toContain('except requests.RequestException as exc:');
      expect(emailTasks!.content).toContain('raise self.retry(exc=exc');
      expect(emailTasks!.content).toContain('validate_transaction_data(');
    });
  });

  describe('Data Processing Tasks', () => {
    it('should generate comprehensive data processing tasks', () => {
      const config = { framework: 'flask' };
      const files = generator.generateCeleryConfig(config);
      const dataTasks = files.find(f => f.path === 'tasks/data_tasks.py');

      expect(dataTasks).toBeDefined();
      expect(dataTasks!.content).toContain('def process_csv_file(');
      expect(dataTasks!.content).toContain('def aggregate_data(');
      expect(dataTasks!.content).toContain('def etl_pipeline(');
      expect(dataTasks!.content).toContain('def generate_report(');
      expect(dataTasks!.content).toContain('def data_quality_check(');
    });

    it('should include pandas operations', () => {
      const config = { framework: 'fastapi' };
      const files = generator.generateCeleryConfig(config);
      const dataTasks = files.find(f => f.path === 'tasks/data_tasks.py');

      expect(dataTasks!.content).toContain('import pandas as pd');
      expect(dataTasks!.content).toContain('df = pd.read_csv(');
      expect(dataTasks!.content).toContain('df = pd.DataFrame(');
      expect(dataTasks!.content).toContain('df.groupby(');
      expect(dataTasks!.content).toContain('df.to_json(');
      expect(dataTasks!.content).toContain('df.to_parquet(');
    });

    it('should include data validation', () => {
      const config = { framework: 'django' };
      const files = generator.generateCeleryConfig(config);
      const dataTasks = files.find(f => f.path === 'tasks/data_tasks.py');

      expect(dataTasks!.content).toContain('validate_dataframe(');
      expect(dataTasks!.content).toContain('required_columns');
      expect(dataTasks!.content).toContain('no_nulls');
      expect(dataTasks!.content).toContain('data_type');
      expect(dataTasks!.content).toContain('ValidationError');
    });
  });

  describe('Notification Tasks', () => {
    it('should generate comprehensive notification tasks', () => {
      const config = { framework: 'tornado' };
      const files = generator.generateCeleryConfig(config);
      const notificationTasks = files.find(f => f.path === 'tasks/notification_tasks.py');

      expect(notificationTasks).toBeDefined();
      expect(notificationTasks!.content).toContain('def send_push_notification(');
      expect(notificationTasks!.content).toContain('def send_sms_notification(');
      expect(notificationTasks!.content).toContain('def send_in_app_notification(');
      expect(notificationTasks!.content).toContain('def broadcast_notification(');
      expect(notificationTasks!.content).toContain('def schedule_notification(');
      expect(notificationTasks!.content).toContain('def send_webhook_notification(');
    });

    it('should include device handling for push notifications', () => {
      const config = { framework: 'sanic' };
      const files = generator.generateCeleryConfig(config);
      const notificationTasks = files.find(f => f.path === 'tasks/notification_tasks.py');

      expect(notificationTasks!.content).toContain('get_user_devices(');
      expect(notificationTasks!.content).toContain('send_to_device(');
      expect(notificationTasks!.content).toContain("platform': 'ios'");
      expect(notificationTasks!.content).toContain("platform': 'android'");
    });

    it('should include scheduling capabilities', () => {
      const config = { framework: 'fastapi' };
      const files = generator.generateCeleryConfig(config);
      const notificationTasks = files.find(f => f.path === 'tasks/notification_tasks.py');

      expect(notificationTasks!.content).toContain('scheduled_time');
      expect(notificationTasks!.content).toContain('repeat_config');
      expect(notificationTasks!.content).toContain('apply_async(');
      expect(notificationTasks!.content).toContain('eta=scheduled_dt');
    });
  });

  describe('Worker Management', () => {
    it('should generate worker management script', () => {
      const config = { framework: 'django' };
      const files = generator.generateCeleryConfig(config);
      const worker = files.find(f => f.path === 'worker.py');

      expect(worker).toBeDefined();
      expect(worker!.content).toContain('class WorkerManager:');
      expect(worker!.content).toContain('def start(');
      expect(worker!.content).toContain('def stop(');
      expect(worker!.content).toContain('def reload(');
      expect(worker!.content).toContain('@worker_ready.connect');
      expect(worker!.content).toContain('@worker_shutdown.connect');
    });

    it('should include framework-specific worker settings', () => {
      const config = { framework: 'fastapi' };
      const files = generator.generateCeleryConfig(config);
      const worker = files.find(f => f.path === 'worker.py');

      expect(worker!.content).toContain("if 'fastapi' == 'fastapi':");
      expect(worker!.content).toContain("options['pool'] = 'gevent'");
    });

    it('should include CLI argument parsing', () => {
      const config = { framework: 'flask' };
      const files = generator.generateCeleryConfig(config);
      const worker = files.find(f => f.path === 'worker.py');

      expect(worker!.content).toContain('argparse.ArgumentParser');
      expect(worker!.content).toContain("'--queues'");
      expect(worker!.content).toContain("'--concurrency'");
      expect(worker!.content).toContain("'--autoscale'");
    });
  });

  describe('Monitoring Tasks', () => {
    it('should generate monitoring tasks', () => {
      const config = { framework: 'django' };
      const files = generator.generateCeleryConfig(config);
      const monitoring = files.find(f => f.path === 'tasks/monitoring.py');

      expect(monitoring).toBeDefined();
      expect(monitoring!.content).toContain('def health_check()');
      expect(monitoring!.content).toContain('def collect_metrics()');
      expect(monitoring!.content).toContain('def monitor_task_performance(');
      expect(monitoring!.content).toContain('def cleanup_old_metrics(');
      expect(monitoring!.content).toContain('def generate_performance_report(');
      expect(monitoring!.content).toContain('def monitor_queue_lengths()');
      expect(monitoring!.content).toContain('def check_worker_health()');
    });

    it('should include system resource monitoring', () => {
      const config = { framework: 'fastapi' };
      const files = generator.generateCeleryConfig(config);
      const monitoring = files.find(f => f.path === 'tasks/monitoring.py');

      expect(monitoring!.content).toContain('import psutil');
      expect(monitoring!.content).toContain('psutil.cpu_percent(');
      expect(monitoring!.content).toContain('psutil.virtual_memory()');
      expect(monitoring!.content).toContain('psutil.disk_usage(');
    });

    it('should include start/stop monitoring when enabled', () => {
      const config = { 
        framework: 'flask',
        enableMonitoring: true
      };
      const files = generator.generateCeleryConfig(config);
      const monitoring = files.find(f => f.path === 'tasks/monitoring.py');

      expect(monitoring!.content).toContain('def start_monitoring()');
      expect(monitoring!.content).toContain('def stop_monitoring()');
    });
  });

  describe('Scheduled Tasks', () => {
    it('should generate scheduled tasks when enabled', () => {
      const config = { 
        framework: 'django',
        enableScheduling: true
      };
      const files = generator.generateCeleryConfig(config);
      const scheduled = files.find(f => f.path === 'tasks/scheduled.py');

      expect(scheduled).toBeDefined();
      expect(scheduled!.content).toContain('app.conf.beat_schedule');
      expect(scheduled!.content).toContain('def send_daily_digests()');
      expect(scheduled!.content).toContain('def process_pending_notifications()');
      expect(scheduled!.content).toContain('def aggregate_daily_data()');
      expect(scheduled!.content).toContain('def generate_weekly_reports()');
      expect(scheduled!.content).toContain('def cleanup_old_data()');
    });

    it('should include crontab schedules', () => {
      const config = { 
        framework: 'fastapi',
        enableScheduling: true
      };
      const files = generator.generateCeleryConfig(config);
      const scheduled = files.find(f => f.path === 'tasks/scheduled.py');

      expect(scheduled!.content).toContain('from celery.schedules import crontab');
      expect(scheduled!.content).toContain('crontab(hour=2, minute=0)');
      expect(scheduled!.content).toContain('day_of_week=1');
      expect(scheduled!.content).toContain('day_of_month=1');
    });
  });

  describe('Docker Configuration', () => {
    it('should generate Celery Dockerfile', () => {
      const config = { framework: 'fastapi' };
      const files = generator.generateCeleryConfig(config);
      const dockerfile = files.find(f => f.path === 'docker/celery.dockerfile');

      expect(dockerfile).toBeDefined();
      expect(dockerfile!.content).toContain('FROM python:3.11-slim');
      expect(dockerfile!.content).toContain('celery[redis]==5.3.*');
      expect(dockerfile!.content).toContain('flower==2.0.*');
      expect(dockerfile!.content).toContain('HEALTHCHECK');
      expect(dockerfile!.content).toContain('CMD ["celery", "-A", "celery_app", "worker", "--loglevel=info"]');
    });

    it('should include monitoring exporter when enabled', () => {
      const config = { 
        framework: 'django',
        enableMonitoring: true
      };
      const files = generator.generateCeleryConfig(config);
      const dockerfile = files.find(f => f.path === 'docker/celery.dockerfile');

      expect(dockerfile!.content).toContain('celery-prometheus-exporter==1.7.*');
    });
  });

  describe('Supervisor Configuration', () => {
    it('should generate supervisor configuration', () => {
      const config = { framework: 'flask' };
      const files = generator.generateCeleryConfig(config);
      const supervisor = files.find(f => f.path === 'config/supervisor/celery.conf');

      expect(supervisor).toBeDefined();
      expect(supervisor!.content).toContain('[program:celery-worker]');
      expect(supervisor!.content).toContain('[program:celery-beat]');
      expect(supervisor!.content).toContain('[program:celery-flower]');
      expect(supervisor!.content).toContain('[group:celery]');
    });

    it('should enable beat when scheduling is enabled', () => {
      const config = { 
        framework: 'tornado',
        enableScheduling: true
      };
      const files = generator.generateCeleryConfig(config);
      const supervisor = files.find(f => f.path === 'config/supervisor/celery.conf');

      expect(supervisor!.content).toContain('autostart=true');
    });

    it('should enable flower when monitoring is enabled', () => {
      const config = { 
        framework: 'sanic',
        enableMonitoring: true
      };
      const files = generator.generateCeleryConfig(config);
      const supervisor = files.find(f => f.path === 'config/supervisor/celery.conf');

      const flowerSection = supervisor!.content.split('[program:celery-flower]')[1];
      expect(flowerSection).toContain('autostart=true');
    });
  });

  describe('Base Task Class', () => {
    it('should include base task with retry configuration', () => {
      const config = { framework: 'fastapi' };
      const files = generator.generateCeleryConfig(config);
      const celeryApp = files.find(f => f.path === 'celery_app.py');

      expect(celeryApp!.content).toContain('class BaseTask(Task):');
      expect(celeryApp!.content).toContain('autoretry_for = (Exception,)');
      expect(celeryApp!.content).toContain("retry_kwargs = {'max_retries': 3}");
      expect(celeryApp!.content).toContain('retry_backoff = True');
      expect(celeryApp!.content).toContain('retry_jitter = True');
      expect(celeryApp!.content).toContain('def on_failure(');
      expect(celeryApp!.content).toContain('def on_retry(');
      expect(celeryApp!.content).toContain('def on_success(');
    });
  });

  describe('Queue Configuration', () => {
    it('should include comprehensive queue configuration', () => {
      const config = { framework: 'django' };
      const files = generator.generateCeleryConfig(config);
      const celeryApp = files.find(f => f.path === 'celery_app.py');

      expect(celeryApp!.content).toContain('app.conf.task_queues');
      expect(celeryApp!.content).toContain("Queue('default'");
      expect(celeryApp!.content).toContain("Queue('high_priority'");
      expect(celeryApp!.content).toContain("Queue('low_priority'");
      expect(celeryApp!.content).toContain("Queue('emails'");
      expect(celeryApp!.content).toContain("Queue('data_processing'");
      expect(celeryApp!.content).toContain("Queue('notifications'");
    });
  });

  describe('Task Annotations', () => {
    it('should include task annotations for rate limiting', () => {
      const config = { framework: 'flask' };
      const files = generator.generateCeleryConfig(config);
      const celeryApp = files.find(f => f.path === 'celery_app.py');

      expect(celeryApp!.content).toContain('app.conf.task_annotations');
      expect(celeryApp!.content).toContain("'*': {'rate_limit': '10/s'}");
      expect(celeryApp!.content).toContain("'tasks.email_tasks.*': {'rate_limit': '5/s'}");
      expect(celeryApp!.content).toContain("'tasks.data_tasks.*': {'time_limit': 600}");
    });
  });
});