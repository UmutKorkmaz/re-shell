import { FileTemplate } from '../types';

interface CeleryConfig {
  framework: string;
  enableScheduling?: boolean;
  enableMonitoring?: boolean;
  enableRetries?: boolean;
  enablePriority?: boolean;
  enableRouting?: boolean;
  enableResultBackend?: boolean;
}

export class CeleryTaskGenerator {
  generateCeleryConfig(config: CeleryConfig): FileTemplate[] {
    const templates: FileTemplate[] = [];

    // Main Celery configuration
    templates.push({
      path: 'celery_app.py',
      content: this.generateCeleryApp(config)
    });

    // Task definitions
    templates.push({
      path: 'tasks/__init__.py',
      content: ''
    });

    templates.push({
      path: 'tasks/email_tasks.py',
      content: this.generateEmailTasks(config)
    });

    templates.push({
      path: 'tasks/data_tasks.py',
      content: this.generateDataTasks(config)
    });

    templates.push({
      path: 'tasks/notification_tasks.py',
      content: this.generateNotificationTasks(config)
    });

    // Worker management
    templates.push({
      path: 'worker.py',
      content: this.generateWorkerScript(config)
    });

    // Monitoring and utilities
    templates.push({
      path: 'tasks/monitoring.py',
      content: this.generateMonitoringTasks(config)
    });

    // Scheduled tasks
    if (config.enableScheduling) {
      templates.push({
        path: 'tasks/scheduled.py',
        content: this.generateScheduledTasks(config)
      });
    }

    // Docker configuration for Celery
    templates.push({
      path: 'docker/celery.dockerfile',
      content: this.generateCeleryDockerfile(config)
    });

    // Supervisor configuration
    templates.push({
      path: 'config/supervisor/celery.conf',
      content: this.generateSupervisorConfig(config)
    });

    // Celery configuration file
    templates.push({
      path: 'celeryconfig.py',
      content: this.generateCeleryConfigFile(config)
    });

    return templates;
  }

  protected generateCeleryApp(config: CeleryConfig): string {
    return `"""
Celery application configuration and initialization.
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

from celery import Celery, Task
from celery.signals import (
    after_setup_logger,
    after_setup_task_logger,
    task_failure,
    task_postrun,
    task_prerun,
    task_retry,
    task_success,
)
from kombu import Exchange, Queue

# Framework-specific imports
${this.getFrameworkImports(config.framework)}

# Initialize Celery app
app = Celery('${config.framework}_tasks')

# Load configuration
app.config_from_object('celeryconfig')

# Task routing configuration
${config.enableRouting ? this.generateTaskRouting() : ''}

# Result backend configuration
${config.enableResultBackend ? this.generateResultBackend() : ''}

# Task execution options
app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes
    task_soft_time_limit=240,  # 4 minutes
    task_acks_late=True,
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
    ${config.enablePriority ? 'task_inherit_parent_priority=True,' : ''}
    ${config.enablePriority ? 'task_default_priority=5,' : ''}
    ${config.enablePriority ? 'task_queue_max_priority=10,' : ''}
)

# Queue configuration
app.conf.task_queues = (
    Queue('default', Exchange('default'), routing_key='default'),
    Queue('high_priority', Exchange('high_priority'), routing_key='high_priority'),
    Queue('low_priority', Exchange('low_priority'), routing_key='low_priority'),
    Queue('emails', Exchange('emails'), routing_key='emails'),
    Queue('data_processing', Exchange('data_processing'), routing_key='data_processing'),
    Queue('notifications', Exchange('notifications'), routing_key='notifications'),
)

# Task annotations for type hints
app.conf.task_annotations = {
    '*': {'rate_limit': '10/s'},
    'tasks.email_tasks.*': {'rate_limit': '5/s'},
    'tasks.data_tasks.*': {'time_limit': 600}}

${config.enableMonitoring ? this.generateMonitoringSignals() : ''}

# Custom task base class
class BaseTask(Task):
    """Base task with error handling and logging."""
    
    autoretry_for = (Exception,)
    retry_kwargs = {'max_retries': 3}
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True
    
    def on_failure(self, exc: Exception, task_id: str, args: tuple, kwargs: dict, einfo: Any) -> None:
        """Handle task failure."""
        print(f'Task {task_id} failed: {exc}')
        super().on_failure(exc, task_id, args, kwargs, einfo)
    
    def on_retry(self, exc: Exception, task_id: str, args: tuple, kwargs: dict, einfo: Any) -> None:
        """Handle task retry."""
        print(f'Task {task_id} retrying: {exc}')
        super().on_retry(exc, task_id, args, kwargs, einfo)
    
    def on_success(self, retval: Any, task_id: str, args: tuple, kwargs: dict) -> None:
        """Handle task success."""
        print(f'Task {task_id} succeeded')
        super().on_success(retval, task_id, args, kwargs)

app.Task = BaseTask

# Framework-specific integration
${this.getFrameworkIntegration(config.framework)}

if __name__ == '__main__':
    app.start()
`;
  }

  protected generateEmailTasks(config: CeleryConfig): string {
    return `"""
Email-related Celery tasks.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from celery import current_app, group, chain, chord
from celery.exceptions import Retry
import requests

from ..celery_app import app

logger = logging.getLogger(__name__)


@app.task(bind=True, queue='emails', priority=8)
def send_email(
    self,
    to: str | List[str],
    subject: str,
    body: str,
    html_body: Optional[str] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Send an email using the configured email service.
    
    Args:
        to: Recipient email address(es)
        subject: Email subject
        body: Plain text body
        html_body: Optional HTML body
        attachments: Optional list of attachments
        
    Returns:
        Email sending result
    """
    try:
        # Normalize recipients
        recipients = [to] if isinstance(to, str) else to
        
        # Prepare email data
        email_data = {
            'to': recipients,
            'subject': subject,
            'text': body,
            'html': html_body,
            'attachments': attachments or []
        }
        
        # Send via email service API
        response = requests.post(
            'http://email-service/api/send',
            json=email_data,
            timeout=30
        )
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Email sent successfully: {result['message_id']}")
        
        return {
            'status': 'sent',
            'message_id': result['message_id'],
            'recipients': recipients
        }
        
    except requests.RequestException as exc:
        logger.error(f"Failed to send email: {exc}")
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
    except Exception as exc:
        logger.error(f"Unexpected error sending email: {exc}")
        return {
            'status': 'failed',
            'error': str(exc),
            'recipients': recipients if 'recipients' in locals() else []
        }


@app.task(queue='emails', priority=6)
def send_bulk_emails(
    email_list: List[Dict[str, Any]],
    template_id: Optional[str] = None,
    batch_size: int = 100
) -> Dict[str, Any]:
    """
    Send bulk emails with batching.
    
    Args:
        email_list: List of email configurations
        template_id: Optional template to use
        batch_size: Number of emails per batch
        
    Returns:
        Bulk sending results
    """
    # Create batches
    batches = [
        email_list[i:i + batch_size]
        for i in range(0, len(email_list), batch_size)
    ]
    
    # Create a group of tasks for parallel execution
    job = group(
        process_email_batch.s(batch, template_id)
        for batch in batches
    )
    
    # Execute and gather results
    result = job.apply_async()
    
    return {
        'status': 'processing',
        'total_emails': len(email_list),
        'batches': len(batches),
        'task_ids': [r.id for r in result.results]
    }


@app.task(queue='emails')
def process_email_batch(
    batch: List[Dict[str, Any]],
    template_id: Optional[str] = None
) -> Dict[str, Any]:
    """Process a batch of emails."""
    successful = 0
    failed = 0
    
    for email_config in batch:
        try:
            # Apply template if specified
            if template_id:
                email_config = apply_email_template(email_config, template_id)
            
            # Send individual email
            result = send_email.apply_async(
                kwargs=email_config,
                priority=email_config.get('priority', 5)
            )
            
            if result.get():
                successful += 1
            else:
                failed += 1
                
        except Exception as exc:
            logger.error(f"Failed to process email: {exc}")
            failed += 1
    
    return {
        'successful': successful,
        'failed': failed,
        'total': len(batch)
    }


@app.task(queue='emails')
def send_notification_email(
    user_id: str,
    notification_type: str,
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Send notification email to user.
    
    Args:
        user_id: User identifier
        notification_type: Type of notification
        context: Template context data
        
    Returns:
        Sending result
    """
    # Fetch user preferences
    user_prefs = get_user_notification_preferences(user_id)
    
    if not user_prefs.get('email_enabled', True):
        return {'status': 'skipped', 'reason': 'email_disabled'}
    
    # Get appropriate template
    template = get_notification_template(notification_type)
    
    # Render email content
    email_content = render_notification_email(template, context)
    
    # Send email
    return send_email.apply_async(
        kwargs={
            'to': user_prefs['email'],
            'subject': email_content['subject'],
            'body': email_content['body'],
            'html_body': email_content['html_body']
        },
        priority=8
    ).get()


@app.task(bind=True, queue='emails', ${config.enableRetries ? 'autoretry_for=(Exception,), retry_kwargs={"max_retries": 5}' : ''})
def send_transactional_email(
    self,
    transaction_type: str,
    recipient: str,
    data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Send transactional emails (receipts, confirmations, etc).
    
    Args:
        transaction_type: Type of transaction
        recipient: Recipient email
        data: Transaction data
        
    Returns:
        Sending result
    """
    try:
        # Validate transaction data
        validate_transaction_data(transaction_type, data)
        
        # Generate email content
        email_content = generate_transaction_email(transaction_type, data)
        
        # Add tracking
        email_content['tracking'] = {
            'transaction_id': data.get('id'),
            'type': transaction_type,
            'timestamp': data.get('timestamp')
        }
        
        # Send with high priority
        return send_email.apply_async(
            kwargs={
                'to': recipient,
                **email_content
            },
            priority=10
        ).get()
        
    except ValidationError as exc:
        logger.error(f"Invalid transaction data: {exc}")
        return {'status': 'failed', 'error': str(exc)}


# Helper functions
def get_user_notification_preferences(user_id: str) -> Dict[str, Any]:
    """Fetch user notification preferences."""
    # Implementation depends on your user service
    return {
        'email': f'user_{user_id}@example.com',
        'email_enabled': True
    }


def get_notification_template(notification_type: str) -> Dict[str, Any]:
    """Get notification template by type."""
    templates = {
        'welcome': {
            'subject': 'Welcome to our platform!',
            'template_id': 'welcome_v1'
        },
        'password_reset': {
            'subject': 'Password Reset Request',
            'template_id': 'password_reset_v1'
        },
        'order_confirmation': {
            'subject': 'Order Confirmation',
            'template_id': 'order_confirm_v1'
        }
    }
    return templates.get(notification_type, {})


def render_notification_email(
    template: Dict[str, Any],
    context: Dict[str, Any]
) -> Dict[str, Any]:
    """Render email template with context."""
    # Template rendering implementation
    return {
        'subject': template['subject'],
        'body': f"Notification email with context: {context}",
        'html_body': f"<h1>{template['subject']}</h1><p>Context: {context}</p>"
    }


def apply_email_template(
    email_config: Dict[str, Any],
    template_id: str
) -> Dict[str, Any]:
    """Apply template to email configuration."""
    # Template application logic
    return email_config


def validate_transaction_data(
    transaction_type: str,
    data: Dict[str, Any]
) -> None:
    """Validate transaction data."""
    required_fields = {
        'order': ['id', 'amount', 'items'],
        'payment': ['id', 'amount', 'method'],
        'refund': ['id', 'amount', 'reason']
    }
    
    fields = required_fields.get(transaction_type, [])
    missing = [f for f in fields if f not in data]
    
    if missing:
        raise ValidationError(f"Missing required fields: {missing}")


def generate_transaction_email(
    transaction_type: str,
    data: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate transaction email content."""
    generators = {
        'order': generate_order_email,
        'payment': generate_payment_email,
        'refund': generate_refund_email
    }
    
    generator = generators.get(transaction_type)
    if generator:
        return generator(data)
    
    return {
        'subject': f'{transaction_type.title()} Notification',
        'body': f'Transaction {data.get("id")} completed.'
    }


def generate_order_email(data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate order confirmation email."""
    return {
        'subject': f'Order #{data["id"]} Confirmed',
        'body': f'Your order for {len(data["items"])} items totaling \\$\{data["amount"]} has been confirmed.',
        'html_body': '<h1>Order Confirmed</h1>...'
    }


def generate_payment_email(data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate payment confirmation email."""
    return {
        'subject': f'Payment Received - \\$\{data["amount"]}',
        'body': f'We have received your payment of \\$\{data["amount"]} via {data["method"]}.',
        'html_body': '<h1>Payment Received</h1>...'
    }


def generate_refund_email(data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate refund notification email."""
    return {
        'subject': f'Refund Processed - \\$\{data["amount"]}',
        'body': f'Your refund of \\$\{data["amount"]} has been processed. Reason: {data["reason"]}',
        'html_body': '<h1>Refund Processed</h1>...'
    }


class ValidationError(Exception):
    """Validation error for transaction data."""
    pass
`;
  }

  protected generateDataTasks(config: CeleryConfig): string {
    return `"""
Data processing Celery tasks.
"""
from __future__ import annotations

import csv
import json
import logging
from datetime import datetime
from io import StringIO
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from celery import current_app, group, chain, chord
from celery.exceptions import Retry

from ..celery_app import app

logger = logging.getLogger(__name__)


@app.task(bind=True, queue='data_processing', time_limit=600)
def process_csv_file(
    self,
    file_path: str,
    processing_options: Dict[str, Any],
    output_format: str = 'json'
) -> Dict[str, Any]:
    """
    Process CSV file with specified options.
    
    Args:
        file_path: Path to CSV file
        processing_options: Processing configuration
        output_format: Output format (json, csv, parquet)
        
    Returns:
        Processing results
    """
    try:
        # Read CSV file
        df = pd.read_csv(file_path, **processing_options.get('read_options', {}))
        
        # Apply transformations
        if 'transformations' in processing_options:
            df = apply_transformations(df, processing_options['transformations'])
        
        # Validate data
        if 'validations' in processing_options:
            validation_results = validate_dataframe(df, processing_options['validations'])
            if not validation_results['valid']:
                return {
                    'status': 'validation_failed',
                    'errors': validation_results['errors']
                }
        
        # Generate output
        output_path = generate_output(df, output_format, file_path)
        
        # Calculate statistics
        stats = calculate_statistics(df)
        
        return {
            'status': 'completed',
            'rows_processed': len(df),
            'output_path': output_path,
            'statistics': stats,
            'processing_time': datetime.utcnow().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Failed to process CSV file: {exc}")
        if self.request.retries < 3:
            raise self.retry(exc=exc, countdown=60)
        return {
            'status': 'failed',
            'error': str(exc)
        }


@app.task(queue='data_processing')
def aggregate_data(
    data_sources: List[str],
    aggregation_config: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Aggregate data from multiple sources.
    
    Args:
        data_sources: List of data source identifiers
        aggregation_config: Aggregation configuration
        
    Returns:
        Aggregation results
    """
    # Create subtasks for parallel processing
    fetch_tasks = group(
        fetch_data_source.s(source)
        for source in data_sources
    )
    
    # Chain with aggregation
    workflow = chain(
        fetch_tasks,
        merge_datasets.s(aggregation_config),
        apply_aggregations.s(aggregation_config)
    )
    
    result = workflow.apply_async()
    
    return {
        'status': 'processing',
        'task_id': result.id,
        'sources': len(data_sources)
    }


@app.task(queue='data_processing')
def fetch_data_source(source_id: str) -> Dict[str, Any]:
    """Fetch data from a single source."""
    # Implementation depends on your data sources
    logger.info(f"Fetching data from source: {source_id}")
    
    # Simulate data fetching
    data = {
        'source_id': source_id,
        'data': generate_sample_data(source_id),
        'fetched_at': datetime.utcnow().isoformat()
    }
    
    return data


@app.task(queue='data_processing')
def merge_datasets(
    datasets: List[Dict[str, Any]],
    config: Dict[str, Any]
) -> pd.DataFrame:
    """Merge multiple datasets."""
    # Convert to DataFrames
    dfs = []
    for dataset in datasets:
        df = pd.DataFrame(dataset['data'])
        df['source'] = dataset['source_id']
        dfs.append(df)
    
    # Merge based on configuration
    merge_on = config.get('merge_on', None)
    if merge_on:
        result = dfs[0]
        for df in dfs[1:]:
            result = pd.merge(result, df, on=merge_on, how=config.get('merge_how', 'inner'))
    else:
        result = pd.concat(dfs, ignore_index=True)
    
    return result.to_dict('records')


@app.task(queue='data_processing')
def apply_aggregations(
    data: List[Dict[str, Any]],
    config: Dict[str, Any]
) -> Dict[str, Any]:
    """Apply aggregations to merged data."""
    df = pd.DataFrame(data)
    
    # Apply grouping
    group_by = config.get('group_by', [])
    if group_by:
        grouped = df.groupby(group_by)
        
        # Apply aggregation functions
        agg_funcs = config.get('aggregations', {})
        result = grouped.agg(agg_funcs)
        
        return {
            'status': 'completed',
            'aggregated_data': result.to_dict('records'),
            'row_count': len(result),
            'columns': list(result.columns)
        }
    
    return {
        'status': 'completed',
        'data': data,
        'row_count': len(data)
    }


@app.task(bind=True, queue='data_processing', ${config.enableRetries ? 'max_retries=5' : ''})
def etl_pipeline(
    self,
    source_config: Dict[str, Any],
    transform_config: Dict[str, Any],
    load_config: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Execute ETL pipeline.
    
    Args:
        source_config: Source configuration
        transform_config: Transformation configuration
        load_config: Load configuration
        
    Returns:
        Pipeline execution results
    """
    try:
        # Extract
        extract_result = extract_data(source_config)
        if extract_result['status'] != 'success':
            return extract_result
        
        # Transform
        transform_result = transform_data(
            extract_result['data'],
            transform_config
        )
        if transform_result['status'] != 'success':
            return transform_result
        
        # Load
        load_result = load_data(
            transform_result['data'],
            load_config
        )
        
        return {
            'status': 'completed',
            'records_processed': load_result['records_loaded'],
            'pipeline_id': self.request.id,
            'execution_time': datetime.utcnow().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"ETL pipeline failed: {exc}")
        raise self.retry(exc=exc, countdown=300)


@app.task(queue='data_processing')
def generate_report(
    report_type: str,
    parameters: Dict[str, Any],
    format: str = 'pdf'
) -> Dict[str, Any]:
    """
    Generate data report.
    
    Args:
        report_type: Type of report to generate
        parameters: Report parameters
        format: Output format (pdf, excel, csv)
        
    Returns:
        Report generation results
    """
    # Fetch required data
    data = fetch_report_data(report_type, parameters)
    
    # Apply report template
    report_content = apply_report_template(report_type, data, parameters)
    
    # Generate output file
    output_path = generate_report_file(report_content, format)
    
    # Send notification if configured
    if parameters.get('notify_on_completion'):
        send_report_notification.delay(
            parameters['user_id'],
            report_type,
            output_path
        )
    
    return {
        'status': 'completed',
        'report_type': report_type,
        'output_path': output_path,
        'format': format,
        'generated_at': datetime.utcnow().isoformat()
    }


@app.task(queue='data_processing')
def data_quality_check(
    dataset_id: str,
    quality_rules: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Perform data quality checks.
    
    Args:
        dataset_id: Dataset identifier
        quality_rules: List of quality rules to apply
        
    Returns:
        Quality check results
    """
    # Load dataset
    data = load_dataset(dataset_id)
    df = pd.DataFrame(data)
    
    results = {
        'dataset_id': dataset_id,
        'total_records': len(df),
        'checks': []
    }
    
    # Apply each quality rule
    for rule in quality_rules:
        check_result = apply_quality_rule(df, rule)
        results['checks'].append(check_result)
    
    # Calculate overall quality score
    passed_checks = sum(1 for check in results['checks'] if check['passed'])
    results['quality_score'] = (passed_checks / len(quality_rules)) * 100
    results['status'] = 'passed' if results['quality_score'] >= 80 else 'failed'
    
    return results


# Helper functions
def apply_transformations(df: pd.DataFrame, transformations: List[Dict[str, Any]]) -> pd.DataFrame:
    """Apply transformations to dataframe."""
    for transform in transformations:
        transform_type = transform['type']
        
        if transform_type == 'rename':
            df = df.rename(columns=transform['mapping'])
        elif transform_type == 'filter':
            df = df.query(transform['condition'])
        elif transform_type == 'compute':
            df[transform['column']] = eval(transform['expression'])
        elif transform_type == 'drop':
            df = df.drop(columns=transform['columns'])
        elif transform_type == 'fillna':
            df = df.fillna(transform['value'])
    
    return df


def validate_dataframe(df: pd.DataFrame, validations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Validate dataframe against rules."""
    errors = []
    
    for validation in validations:
        val_type = validation['type']
        
        if val_type == 'required_columns':
            missing = set(validation['columns']) - set(df.columns)
            if missing:
                errors.append(f"Missing required columns: {missing}")
        
        elif val_type == 'no_nulls':
            null_columns = df[validation['columns']].isnull().any()
            null_cols = [col for col in validation['columns'] if null_columns[col]]
            if null_cols:
                errors.append(f"Null values found in: {null_cols}")
        
        elif val_type == 'unique':
            for col in validation['columns']:
                if df[col].duplicated().any():
                    errors.append(f"Duplicate values in column: {col}")
        
        elif val_type == 'data_type':
            for col, dtype in validation['types'].items():
                if df[col].dtype != dtype:
                    errors.append(f"Invalid data type for {col}: expected {dtype}, got {df[col].dtype}")
    
    return {
        'valid': len(errors) == 0,
        'errors': errors
    }


def generate_output(df: pd.DataFrame, format: str, original_path: str) -> str:
    """Generate output file in specified format."""
    base_path = original_path.rsplit('.', 1)[0]
    
    if format == 'json':
        output_path = f"{base_path}_processed.json"
        df.to_json(output_path, orient='records', date_format='iso')
    elif format == 'csv':
        output_path = f"{base_path}_processed.csv"
        df.to_csv(output_path, index=False)
    elif format == 'parquet':
        output_path = f"{base_path}_processed.parquet"
        df.to_parquet(output_path, engine='pyarrow')
    else:
        raise ValueError(f"Unsupported format: {format}")
    
    return output_path


class ValidationError(Exception):
    """Custom validation error for data processing."""
    pass


def calculate_statistics(df: pd.DataFrame) -> Dict[str, Any]:
    """Calculate dataframe statistics."""
    stats = {
        'row_count': len(df),
        'column_count': len(df.columns),
        'memory_usage': df.memory_usage(deep=True).sum(),
        'numeric_columns': df.select_dtypes(include=['number']).columns.tolist(),
        'string_columns': df.select_dtypes(include=['object']).columns.tolist()
    }
    
    # Numeric statistics
    numeric_stats = df.describe().to_dict()
    stats['numeric_stats'] = numeric_stats
    
    return stats


def generate_sample_data(source_id: str) -> List[Dict[str, Any]]:
    """Generate sample data for testing."""
    import random
    
    return [
        {
            'id': i,
            'source': source_id,
            'value': random.randint(1, 100),
            'timestamp': datetime.utcnow().isoformat()
        }
        for i in range(100)
    ]


def extract_data(config: Dict[str, Any]) -> Dict[str, Any]:
    """Extract data from source."""
    source_type = config['type']
    
    if source_type == 'database':
        # Database extraction logic
        return {'status': 'success', 'data': []}
    elif source_type == 'api':
        # API extraction logic
        return {'status': 'success', 'data': []}
    elif source_type == 'file':
        # File extraction logic
        return {'status': 'success', 'data': []}
    
    return {'status': 'error', 'message': f'Unknown source type: {source_type}'}


def transform_data(data: List[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
    """Transform extracted data."""
    try:
        df = pd.DataFrame(data)
        
        # Apply transformations
        if 'transformations' in config:
            df = apply_transformations(df, config['transformations'])
        
        return {
            'status': 'success',
            'data': df.to_dict('records')
        }
    except Exception as exc:
        return {
            'status': 'error',
            'message': str(exc)
        }


def load_data(data: List[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
    """Load data to destination."""
    destination = config['destination']
    
    if destination == 'database':
        # Database loading logic
        return {'status': 'success', 'records_loaded': len(data)}
    elif destination == 'file':
        # File loading logic
        return {'status': 'success', 'records_loaded': len(data)}
    elif destination == 'api':
        # API loading logic
        return {'status': 'success', 'records_loaded': len(data)}
    
    return {'status': 'error', 'message': f'Unknown destination: {destination}'}


def fetch_report_data(report_type: str, parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Fetch data for report generation."""
    # Implementation depends on report type
    return []


def apply_report_template(
    report_type: str,
    data: List[Dict[str, Any]],
    parameters: Dict[str, Any]
) -> Dict[str, Any]:
    """Apply report template to data."""
    return {
        'title': f'{report_type} Report',
        'data': data,
        'parameters': parameters
    }


def generate_report_file(content: Dict[str, Any], format: str) -> str:
    """Generate report file."""
    output_path = f"/tmp/report_{datetime.utcnow().timestamp()}.{format}"
    
    if format == 'pdf':
        # PDF generation logic
        pass
    elif format == 'excel':
        # Excel generation logic
        pass
    elif format == 'csv':
        # CSV generation logic
        pass
    
    return output_path


def load_dataset(dataset_id: str) -> List[Dict[str, Any]]:
    """Load dataset by ID."""
    # Dataset loading implementation
    return []


def apply_quality_rule(df: pd.DataFrame, rule: Dict[str, Any]) -> Dict[str, Any]:
    """Apply single quality rule to dataframe."""
    rule_type = rule['type']
    
    if rule_type == 'completeness':
        missing_ratio = df[rule['column']].isnull().mean()
        passed = missing_ratio <= rule['threshold']
    elif rule_type == 'range':
        out_of_range = ~df[rule['column']].between(rule['min'], rule['max'])
        passed = out_of_range.sum() == 0
    elif rule_type == 'pattern':
        invalid = ~df[rule['column']].str.match(rule['pattern'])
        passed = invalid.sum() == 0
    else:
        passed = True
    
    return {
        'rule': rule['name'],
        'type': rule_type,
        'passed': passed
    }


@app.task(queue='notifications')
def send_report_notification(
    user_id: str,
    report_type: str,
    output_path: str
) -> None:
    """Send notification about completed report."""
    # Notification implementation
    pass
`;
  }

  protected generateNotificationTasks(config: CeleryConfig): string {
    return `"""
Notification-related Celery tasks.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set

from celery import current_app, group, chain, chord
from celery.exceptions import Retry
import requests
import redis

from ..celery_app import app

logger = logging.getLogger(__name__)

# Redis client for notification state
redis_client = redis.Redis(
    host='localhost',
    port=6379,
    decode_responses=True
)


@app.task(bind=True, queue='notifications', priority=9)
def send_push_notification(
    self,
    user_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    priority: str = 'normal'
) -> Dict[str, Any]:
    """
    Send push notification to user devices.
    
    Args:
        user_id: User identifier
        title: Notification title
        body: Notification body
        data: Optional payload data
        priority: Notification priority (low, normal, high)
        
    Returns:
        Notification sending results
    """
    try:
        # Get user devices
        devices = get_user_devices(user_id)
        
        if not devices:
            return {
                'status': 'no_devices',
                'user_id': user_id
            }
        
        # Prepare notification payload
        payload = {
            'title': title,
            'body': body,
            'data': data or {},
            'priority': priority,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Send to each device
        results = []
        for device in devices:
            try:
                result = send_to_device(device, payload)
                results.append({
                    'device_id': device['id'],
                    'platform': device['platform'],
                    'status': result['status']
                })
            except Exception as exc:
                logger.error(f"Failed to send to device {device['id']}: {exc}")
                results.append({
                    'device_id': device['id'],
                    'platform': device['platform'],
                    'status': 'failed',
                    'error': str(exc)
                })
        
        # Store notification in history
        store_notification_history(user_id, payload, results)
        
        return {
            'status': 'sent',
            'user_id': user_id,
            'devices_notified': len([r for r in results if r['status'] == 'success']),
            'total_devices': len(devices),
            'results': results
        }
        
    except Exception as exc:
        logger.error(f"Failed to send push notification: {exc}")
        if self.request.retries < 3:
            raise self.retry(exc=exc, countdown=30)
        return {
            'status': 'failed',
            'error': str(exc)
        }


@app.task(queue='notifications')
def send_sms_notification(
    phone_number: str,
    message: str,
    sender_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send SMS notification.
    
    Args:
        phone_number: Recipient phone number
        message: SMS message content
        sender_id: Optional sender ID
        
    Returns:
        SMS sending result
    """
    try:
        # Validate phone number
        if not validate_phone_number(phone_number):
            return {
                'status': 'failed',
                'error': 'Invalid phone number'
            }
        
        # Check message length
        if len(message) > 160:
            # Split into multiple messages
            messages = split_sms_message(message)
        else:
            messages = [message]
        
        # Send via SMS provider
        results = []
        for idx, msg in enumerate(messages):
            response = requests.post(
                'https://sms-provider.com/send',
                json={
                    'to': phone_number,
                    'message': msg,
                    'sender': sender_id or 'DEFAULT',
                    'part': f'{idx + 1}/{len(messages)}' if len(messages) > 1 else None
                },
                timeout=10
            )
            
            results.append({
                'part': idx + 1,
                'status': response.json().get('status'),
                'message_id': response.json().get('message_id')
            })
        
        return {
            'status': 'sent',
            'phone_number': phone_number,
            'parts': len(messages),
            'results': results
        }
        
    except Exception as exc:
        logger.error(f"Failed to send SMS: {exc}")
        return {
            'status': 'failed',
            'error': str(exc)
        }


@app.task(queue='notifications')
def send_in_app_notification(
    user_id: str,
    notification_type: str,
    title: str,
    content: str,
    action_url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Send in-app notification.
    
    Args:
        user_id: User identifier
        notification_type: Type of notification
        title: Notification title
        content: Notification content
        action_url: Optional action URL
        metadata: Optional metadata
        
    Returns:
        Notification creation result
    """
    # Create notification record
    notification = {
        'id': generate_notification_id(),
        'user_id': user_id,
        'type': notification_type,
        'title': title,
        'content': content,
        'action_url': action_url,
        'metadata': metadata or {},
        'created_at': datetime.utcnow().isoformat(),
        'read': False
    }
    
    # Store in database
    store_in_app_notification(notification)
    
    # Publish to real-time channel
    publish_realtime_notification(user_id, notification)
    
    # Update unread count
    increment_unread_count(user_id)
    
    return {
        'status': 'created',
        'notification_id': notification['id'],
        'user_id': user_id
    }


@app.task(queue='notifications')
def broadcast_notification(
    user_ids: List[str],
    notification_config: Dict[str, Any],
    channels: List[str] = None
) -> Dict[str, Any]:
    """
    Broadcast notification to multiple users.
    
    Args:
        user_ids: List of user IDs
        notification_config: Notification configuration
        channels: Notification channels (push, sms, email, in_app)
        
    Returns:
        Broadcast results
    """
    if channels is None:
        channels = ['push', 'in_app']
    
    # Create subtasks for each user and channel
    tasks = []
    for user_id in user_ids:
        for channel in channels:
            if channel == 'push':
                tasks.append(
                    send_push_notification.s(
                        user_id,
                        notification_config['title'],
                        notification_config['body'],
                        notification_config.get('data')
                    )
                )
            elif channel == 'email':
                tasks.append(
                    send_notification_email.s(
                        user_id,
                        notification_config['type'],
                        notification_config.get('context', {})
                    )
                )
            elif channel == 'in_app':
                tasks.append(
                    send_in_app_notification.s(
                        user_id,
                        notification_config['type'],
                        notification_config['title'],
                        notification_config['body'],
                        notification_config.get('action_url')
                    )
                )
    
    # Execute in parallel
    job = group(tasks)
    result = job.apply_async()
    
    return {
        'status': 'broadcasting',
        'total_users': len(user_ids),
        'channels': channels,
        'task_ids': [r.id for r in result.results]
    }


@app.task(queue='notifications')
def schedule_notification(
    notification_config: Dict[str, Any],
    scheduled_time: str,
    repeat_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Schedule notification for future delivery.
    
    Args:
        notification_config: Notification configuration
        scheduled_time: ISO format scheduled time
        repeat_config: Optional repeat configuration
        
    Returns:
        Scheduling result
    """
    # Parse scheduled time
    scheduled_dt = datetime.fromisoformat(scheduled_time)
    
    # Calculate ETA
    eta = scheduled_dt - datetime.utcnow()
    
    if eta.total_seconds() <= 0:
        return {
            'status': 'failed',
            'error': 'Scheduled time must be in the future'
        }
    
    # Determine task based on notification type
    if notification_config['channel'] == 'push':
        task = send_push_notification
    elif notification_config['channel'] == 'email':
        task = send_notification_email
    elif notification_config['channel'] == 'sms':
        task = send_sms_notification
    else:
        task = send_in_app_notification
    
    # Schedule task
    result = task.apply_async(
        kwargs=notification_config['params'],
        eta=scheduled_dt
    )
    
    # Store scheduled notification
    scheduled_id = store_scheduled_notification(
        notification_config,
        scheduled_time,
        result.id,
        repeat_config
    )
    
    # Schedule repeat if configured
    if repeat_config:
        schedule_repeat_notification.apply_async(
            args=[scheduled_id, repeat_config],
            eta=scheduled_dt + timedelta(seconds=repeat_config['interval'])
        )
    
    return {
        'status': 'scheduled',
        'scheduled_id': scheduled_id,
        'task_id': result.id,
        'scheduled_time': scheduled_time,
        'repeat': repeat_config is not None
    }


@app.task(queue='notifications')
def schedule_repeat_notification(
    scheduled_id: str,
    repeat_config: Dict[str, Any]
) -> None:
    """Handle repeat notification scheduling."""
    # Load original notification
    notification = load_scheduled_notification(scheduled_id)
    
    if not notification or not notification['active']:
        return
    
    # Check repeat count
    if repeat_config.get('max_count'):
        if notification['repeat_count'] >= repeat_config['max_count']:
            deactivate_scheduled_notification(scheduled_id)
            return
    
    # Schedule next occurrence
    next_time = datetime.utcnow() + timedelta(seconds=repeat_config['interval'])
    
    schedule_notification(
        notification['config'],
        next_time.isoformat(),
        repeat_config
    )
    
    # Update repeat count
    increment_repeat_count(scheduled_id)


@app.task(bind=True, queue='notifications', ${config.enableRetries ? 'autoretry_for=(Exception,), retry_kwargs={"max_retries": 3}' : ''})
def send_webhook_notification(
    self,
    webhook_url: str,
    event_type: str,
    payload: Dict[str, Any],
    headers: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Send webhook notification.
    
    Args:
        webhook_url: Webhook endpoint URL
        event_type: Event type identifier
        payload: Webhook payload
        headers: Optional custom headers
        
    Returns:
        Webhook sending result
    """
    try:
        # Prepare headers
        webhook_headers = {
            'Content-Type': 'application/json',
            'X-Event-Type': event_type,
            'X-Timestamp': datetime.utcnow().isoformat()
        }
        if headers:
            webhook_headers.update(headers)
        
        # Add signature for security
        signature = generate_webhook_signature(payload)
        webhook_headers['X-Signature'] = signature
        
        # Send webhook
        response = requests.post(
            webhook_url,
            json=payload,
            headers=webhook_headers,
            timeout=30
        )
        
        # Log response
        log_webhook_attempt(webhook_url, event_type, response.status_code)
        
        if response.status_code >= 400:
            raise Exception(f"Webhook failed with status {response.status_code}")
        
        return {
            'status': 'sent',
            'webhook_url': webhook_url,
            'event_type': event_type,
            'response_code': response.status_code
        }
        
    except requests.Timeout:
        logger.error(f"Webhook timeout: {webhook_url}")
        raise self.retry(countdown=60)
    except Exception as exc:
        logger.error(f"Webhook failed: {exc}")
        raise self.retry(exc=exc, countdown=120)


@app.task(queue='notifications')
def process_notification_preferences(
    user_id: str,
    preferences: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Update user notification preferences.
    
    Args:
        user_id: User identifier
        preferences: Notification preferences
        
    Returns:
        Update result
    """
    # Validate preferences
    valid_channels = ['push', 'email', 'sms', 'in_app']
    valid_types = ['marketing', 'transactional', 'updates', 'alerts']
    
    # Update preferences
    updated = {}
    for channel in valid_channels:
        if channel in preferences:
            for notif_type in valid_types:
                key = f'{channel}_{notif_type}'
                if notif_type in preferences[channel]:
                    updated[key] = preferences[channel][notif_type]
                    update_user_preference(user_id, key, preferences[channel][notif_type])
    
    # Update quiet hours if specified
    if 'quiet_hours' in preferences:
        update_quiet_hours(user_id, preferences['quiet_hours'])
        updated['quiet_hours'] = preferences['quiet_hours']
    
    return {
        'status': 'updated',
        'user_id': user_id,
        'updated_preferences': updated
    }


# Helper functions
def get_user_devices(user_id: str) -> List[Dict[str, Any]]:
    """Get user's registered devices."""
    # Mock implementation
    return [
        {
            'id': f'device_{user_id}_1',
            'platform': 'ios',
            'token': 'mock_token_ios'
        },
        {
            'id': f'device_{user_id}_2',
            'platform': 'android',
            'token': 'mock_token_android'
        }
    ]


def send_to_device(device: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    """Send notification to specific device."""
    platform = device['platform']
    
    if platform == 'ios':
        # iOS push notification logic
        return {'status': 'success'}
    elif platform == 'android':
        # Android push notification logic
        return {'status': 'success'}
    else:
        raise ValueError(f"Unsupported platform: {platform}")


def store_notification_history(
    user_id: str,
    payload: Dict[str, Any],
    results: List[Dict[str, Any]]
) -> None:
    """Store notification in history."""
    history = {
        'user_id': user_id,
        'payload': payload,
        'results': results,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    # Store in Redis with TTL
    key = f'notification_history:{user_id}:{datetime.utcnow().timestamp()}'
    redis_client.setex(key, 86400 * 30, json.dumps(history))  # 30 days TTL


def validate_phone_number(phone: str) -> bool:
    """Validate phone number format."""
    # Simple validation - implement proper validation
    return len(phone) >= 10 and phone.replace('+', '').replace('-', '').isdigit()


def split_sms_message(message: str) -> List[str]:
    """Split long SMS message into parts."""
    max_length = 153  # Account for part numbering
    parts = []
    
    for i in range(0, len(message), max_length):
        parts.append(message[i:i + max_length])
    
    return parts


def generate_notification_id() -> str:
    """Generate unique notification ID."""
    import uuid
    return str(uuid.uuid4())


def store_in_app_notification(notification: Dict[str, Any]) -> None:
    """Store in-app notification."""
    # Database storage implementation
    key = f'in_app_notification:{notification["user_id"]}:{notification["id"]}'
    redis_client.setex(key, 86400 * 7, json.dumps(notification))  # 7 days TTL


def publish_realtime_notification(user_id: str, notification: Dict[str, Any]) -> None:
    """Publish notification to real-time channel."""
    channel = f'notifications:{user_id}'
    redis_client.publish(channel, json.dumps(notification))


def increment_unread_count(user_id: str) -> None:
    """Increment user's unread notification count."""
    key = f'unread_count:{user_id}'
    redis_client.incr(key)


def store_scheduled_notification(
    config: Dict[str, Any],
    scheduled_time: str,
    task_id: str,
    repeat_config: Optional[Dict[str, Any]]
) -> str:
    """Store scheduled notification details."""
    import uuid
    scheduled_id = str(uuid.uuid4())
    
    data = {
        'id': scheduled_id,
        'config': config,
        'scheduled_time': scheduled_time,
        'task_id': task_id,
        'repeat_config': repeat_config,
        'repeat_count': 0,
        'active': True,
        'created_at': datetime.utcnow().isoformat()
    }
    
    key = f'scheduled_notification:{scheduled_id}'
    redis_client.set(key, json.dumps(data))
    
    return scheduled_id


def load_scheduled_notification(scheduled_id: str) -> Optional[Dict[str, Any]]:
    """Load scheduled notification details."""
    key = f'scheduled_notification:{scheduled_id}'
    data = redis_client.get(key)
    return json.loads(data) if data else None


def deactivate_scheduled_notification(scheduled_id: str) -> None:
    """Deactivate scheduled notification."""
    notification = load_scheduled_notification(scheduled_id)
    if notification:
        notification['active'] = False
        key = f'scheduled_notification:{scheduled_id}'
        redis_client.set(key, json.dumps(notification))


def increment_repeat_count(scheduled_id: str) -> None:
    """Increment repeat count for scheduled notification."""
    notification = load_scheduled_notification(scheduled_id)
    if notification:
        notification['repeat_count'] += 1
        key = f'scheduled_notification:{scheduled_id}'
        redis_client.set(key, json.dumps(notification))


def generate_webhook_signature(payload: Dict[str, Any]) -> str:
    """Generate webhook signature for security."""
    import hashlib
    import hmac
    
    secret = 'webhook_secret'  # Should be from configuration
    payload_str = json.dumps(payload, sort_keys=True)
    
    return hmac.new(
        secret.encode(),
        payload_str.encode(),
        hashlib.sha256
    ).hexdigest()


def log_webhook_attempt(webhook_url: str, event_type: str, status_code: int) -> None:
    """Log webhook attempt."""
    log = {
        'webhook_url': webhook_url,
        'event_type': event_type,
        'status_code': status_code,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    key = f'webhook_log:{datetime.utcnow().timestamp()}'
    redis_client.setex(key, 86400 * 7, json.dumps(log))  # 7 days TTL


def update_user_preference(user_id: str, key: str, value: bool) -> None:
    """Update user notification preference."""
    pref_key = f'user_preferences:{user_id}:{key}'
    redis_client.set(pref_key, str(value))


def update_quiet_hours(user_id: str, quiet_hours: Dict[str, str]) -> None:
    """Update user quiet hours settings."""
    key = f'quiet_hours:{user_id}'
    redis_client.set(key, json.dumps(quiet_hours))


# Import for email tasks
from ..tasks.email_tasks import send_notification_email
`;
  }

  protected generateWorkerScript(config: CeleryConfig): string {
    return `#!/usr/bin/env python
"""
Celery worker management script.
"""
import argparse
import logging
import os
import signal
import sys
from typing import List, Optional

from celery import current_app
from celery.bin import worker
from celery.signals import worker_ready, worker_shutdown

from celery_app import app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class WorkerManager:
    """Manage Celery worker lifecycle."""
    
    def __init__(self, app):
        self.app = app
        self.worker = None
    
    def start(
        self,
        queues: Optional[List[str]] = None,
        concurrency: Optional[int] = None,
        loglevel: str = 'info',
        pool: str = 'prefork'
    ):
        """Start Celery worker with configuration."""
        logger.info("Starting Celery worker...")
        
        # Configure worker
        worker_instance = worker.worker(app=self.app)
        
        # Set options
        options = {
            'loglevel': loglevel,
            'pool': pool}
        
        if queues:
            options['queues'] = ','.join(queues)
        
        if concurrency:
            options['concurrency'] = concurrency
        
        # Add framework-specific settings
        if '${config.framework}' == 'fastapi':
            options['pool'] = 'gevent'  # Better for async
        elif '${config.framework}' == 'django':
            options['pool'] = 'prefork'  # Better for Django ORM
        
        # Start worker
        worker_instance.run(**options)
    
    def stop(self):
        """Stop Celery worker gracefully."""
        logger.info("Stopping Celery worker...")
        if self.worker:
            self.worker.stop()
    
    def reload(self):
        """Reload worker configuration."""
        logger.info("Reloading Celery worker...")
        os.kill(os.getpid(), signal.SIGHUP)


@worker_ready.connect
def on_worker_ready(sender=None, **kwargs):
    """Handle worker ready signal."""
    logger.info("Worker is ready and accepting tasks")
    
    # Perform startup tasks
    if ${config.enableMonitoring ? 'True' : 'False'}:
        from tasks.monitoring import start_monitoring
        start_monitoring.delay()


@worker_shutdown.connect
def on_worker_shutdown(sender=None, **kwargs):
    """Handle worker shutdown signal."""
    logger.info("Worker is shutting down")
    
    # Cleanup tasks
    if ${config.enableMonitoring ? 'True' : 'False'}:
        from tasks.monitoring import stop_monitoring
        stop_monitoring.delay()


def main():
    """Main entry point for worker script."""
    parser = argparse.ArgumentParser(description='Celery Worker Manager')
    
    parser.add_argument(
        '--queues',
        nargs='+',
        help='Queues to consume from',
        default=['default']
    )
    
    parser.add_argument(
        '--concurrency',
        type=int,
        help='Number of concurrent workers',
        default=4
    )
    
    parser.add_argument(
        '--loglevel',
        choices=['debug', 'info', 'warning', 'error'],
        default='info',
        help='Logging level'
    )
    
    parser.add_argument(
        '--pool',
        choices=['prefork', 'eventlet', 'gevent', 'solo'],
        default='prefork',
        help='Pool implementation'
    )
    
    parser.add_argument(
        '--autoscale',
        help='Autoscaling settings (max,min)',
        default=None
    )
    
    parser.add_argument(
        '--max-tasks-per-child',
        type=int,
        help='Maximum tasks per worker child',
        default=1000
    )
    
    args = parser.parse_args()
    
    # Configure autoscaling
    if args.autoscale:
        max_workers, min_workers = map(int, args.autoscale.split(','))
        app.conf.worker_autoscaler = True
        app.conf.worker_max_concurrency = max_workers
        app.conf.worker_min_concurrency = min_workers
    
    # Set max tasks per child
    app.conf.worker_max_tasks_per_child = args.max_tasks_per_child
    
    # Create and start worker manager
    manager = WorkerManager(app)
    
    try:
        manager.start(
            queues=args.queues,
            concurrency=args.concurrency,
            loglevel=args.loglevel,
            pool=args.pool
        )
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
        manager.stop()
        sys.exit(0)
    except Exception as e:
        logger.error(f"Worker failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
`;
  }

  protected generateMonitoringTasks(config: CeleryConfig): string {
    return `"""
Monitoring and health check tasks for Celery.
"""
from __future__ import annotations

import logging
import os
import psutil
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from celery import current_app
from celery.task.control import inspect
import redis

from ..celery_app import app

logger = logging.getLogger(__name__)

# Redis client for metrics
redis_client = redis.Redis(
    host='localhost',
    port=6379,
    decode_responses=True
)


@app.task(queue='monitoring')
def health_check() -> Dict[str, Any]:
    """
    Perform comprehensive health check.
    
    Returns:
        Health status information
    """
    health_status = {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'checks': {}
    }
    
    # Check Celery connectivity
    try:
        i = inspect()
        stats = i.stats()
        health_status['checks']['celery'] = {
            'status': 'up' if stats else 'down',
            'workers': len(stats) if stats else 0
        }
    except Exception as exc:
        health_status['checks']['celery'] = {
            'status': 'error',
            'error': str(exc)
        }
        health_status['status'] = 'degraded'
    
    # Check Redis connectivity
    try:
        redis_client.ping()
        health_status['checks']['redis'] = {'status': 'up'}
    except Exception as exc:
        health_status['checks']['redis'] = {
            'status': 'down',
            'error': str(exc)
        }
        health_status['status'] = 'unhealthy'
    
    # Check system resources
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        health_status['checks']['system'] = {
            'status': 'healthy',
            'cpu_percent': cpu_percent,
            'memory_percent': memory.percent,
            'disk_percent': disk.percent
        }
        
        # Alert if resources are high
        if cpu_percent > 80 or memory.percent > 80 or disk.percent > 90:
            health_status['status'] = 'warning'
            health_status['checks']['system']['status'] = 'warning'
    except Exception as exc:
        health_status['checks']['system'] = {
            'status': 'error',
            'error': str(exc)
        }
    
    return health_status


@app.task(queue='monitoring')
def collect_metrics() -> Dict[str, Any]:
    """
    Collect Celery and system metrics.
    
    Returns:
        Collected metrics
    """
    metrics = {
        'timestamp': datetime.utcnow().isoformat(),
        'celery': {},
        'system': {},
        'tasks': {}
    }
    
    # Collect Celery metrics
    i = inspect()
    
    # Active tasks
    active = i.active()
    if active:
        total_active = sum(len(tasks) for tasks in active.values())
        metrics['celery']['active_tasks'] = total_active
    
    # Scheduled tasks
    scheduled = i.scheduled()
    if scheduled:
        total_scheduled = sum(len(tasks) for tasks in scheduled.values())
        metrics['celery']['scheduled_tasks'] = total_scheduled
    
    # Reserved tasks
    reserved = i.reserved()
    if reserved:
        total_reserved = sum(len(tasks) for tasks in reserved.values())
        metrics['celery']['reserved_tasks'] = total_reserved
    
    # Worker stats
    stats = i.stats()
    if stats:
        metrics['celery']['workers'] = len(stats)
        metrics['celery']['worker_stats'] = stats
    
    # System metrics
    metrics['system']['cpu_percent'] = psutil.cpu_percent(interval=1)
    metrics['system']['memory'] = dict(psutil.virtual_memory()._asdict())
    metrics['system']['disk'] = dict(psutil.disk_usage('/')._asdict())
    metrics['system']['network'] = dict(psutil.net_io_counters()._asdict())
    
    # Task execution metrics
    task_metrics = get_task_metrics()
    metrics['tasks'] = task_metrics
    
    # Store metrics
    store_metrics(metrics)
    
    return metrics


@app.task(queue='monitoring')
def monitor_task_performance(
    task_name: str,
    execution_time: float,
    success: bool,
    args: Optional[tuple] = None,
    kwargs: Optional[dict] = None
) -> None:
    """
    Monitor individual task performance.
    
    Args:
        task_name: Name of the task
        execution_time: Task execution time in seconds
        success: Whether task succeeded
        args: Task arguments
        kwargs: Task keyword arguments
    """
    # Create metric entry
    metric = {
        'task_name': task_name,
        'execution_time': execution_time,
        'success': success,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    # Store in time series
    key = f'task_metrics:{task_name}:{datetime.utcnow().strftime("%Y%m%d")}'
    redis_client.lpush(key, json.dumps(metric))
    redis_client.expire(key, 86400 * 7)  # 7 days retention
    
    # Update aggregated metrics
    update_task_aggregates(task_name, execution_time, success)
    
    # Check for performance degradation
    if execution_time > get_task_threshold(task_name):
        alert_slow_task(task_name, execution_time, args, kwargs)


@app.task(queue='monitoring')
def cleanup_old_metrics(retention_days: int = 7) -> Dict[str, int]:
    """
    Clean up old metrics data.
    
    Args:
        retention_days: Number of days to retain metrics
        
    Returns:
        Cleanup statistics
    """
    cleanup_stats = {
        'deleted_keys': 0,
        'freed_memory': 0
    }
    
    # Calculate cutoff date
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    
    # Find and delete old metric keys
    pattern = 'task_metrics:*'
    cursor = 0
    
    while True:
        cursor, keys = redis_client.scan(cursor, match=pattern, count=100)
        
        for key in keys:
            # Extract date from key
            parts = key.split(':')
            if len(parts) >= 3:
                date_str = parts[2]
                try:
                    key_date = datetime.strptime(date_str, '%Y%m%d')
                    if key_date < cutoff:
                        redis_client.delete(key)
                        cleanup_stats['deleted_keys'] += 1
                except ValueError:
                    continue
        
        if cursor == 0:
            break
    
    # Get memory info
    info = redis_client.info('memory')
    cleanup_stats['freed_memory'] = info.get('used_memory', 0)
    
    return cleanup_stats


@app.task(queue='monitoring')
def generate_performance_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate performance report for specified period.
    
    Args:
        start_date: Start date (ISO format)
        end_date: End date (ISO format)
        
    Returns:
        Performance report
    """
    # Default to last 24 hours
    if not end_date:
        end_dt = datetime.utcnow()
    else:
        end_dt = datetime.fromisoformat(end_date)
    
    if not start_date:
        start_dt = end_dt - timedelta(days=1)
    else:
        start_dt = datetime.fromisoformat(start_date)
    
    report = {
        'period': {
            'start': start_dt.isoformat(),
            'end': end_dt.isoformat()
        },
        'summary': {},
        'tasks': {},
        'workers': {},
        'errors': []
    }
    
    # Get task performance data
    task_data = get_task_performance_data(start_dt, end_dt)
    report['tasks'] = task_data
    
    # Calculate summary statistics
    if task_data:
        total_tasks = sum(t['count'] for t in task_data.values())
        successful_tasks = sum(t['successful'] for t in task_data.values())
        failed_tasks = sum(t['failed'] for t in task_data.values())
        
        report['summary'] = {
            'total_tasks': total_tasks,
            'successful_tasks': successful_tasks,
            'failed_tasks': failed_tasks,
            'success_rate': (successful_tasks / total_tasks * 100) if total_tasks > 0 else 0,
            'average_execution_time': sum(t['avg_time'] for t in task_data.values()) / len(task_data)
        }
    
    # Get worker statistics
    worker_stats = get_worker_statistics(start_dt, end_dt)
    report['workers'] = worker_stats
    
    # Get error information
    errors = get_error_summary(start_dt, end_dt)
    report['errors'] = errors
    
    # Store report
    store_performance_report(report)
    
    return report


@app.task(queue='monitoring')
def monitor_queue_lengths() -> Dict[str, int]:
    """
    Monitor queue lengths and alert if needed.
    
    Returns:
        Queue lengths
    """
    queue_lengths = {}
    alert_threshold = 1000
    
    # Get queue names from configuration
    queues = [
        'default',
        'high_priority',
        'low_priority',
        'emails',
        'data_processing',
        'notifications',
        'monitoring'
    ]
    
    for queue_name in queues:
        length = redis_client.llen(queue_name)
        queue_lengths[queue_name] = length
        
        # Alert if queue is too long
        if length > alert_threshold:
            send_queue_alert(queue_name, length)
    
    # Store queue metrics
    store_queue_metrics(queue_lengths)
    
    return queue_lengths


@app.task(queue='monitoring')
def check_worker_health() -> Dict[str, Any]:
    """
    Check health of all workers.
    
    Returns:
        Worker health status
    """
    i = inspect()
    
    health_report = {
        'timestamp': datetime.utcnow().isoformat(),
        'workers': {},
        'issues': []
    }
    
    # Get all workers
    stats = i.stats()
    if not stats:
        health_report['issues'].append('No workers found')
        return health_report
    
    # Check each worker
    for worker_name, worker_stats in stats.items():
        worker_health = {
            'status': 'healthy',
            'pool': worker_stats.get('pool', {}).get('implementation', 'unknown'),
            'max_concurrency': worker_stats.get('pool', {}).get('max-concurrency', 0),
            'processes': len(worker_stats.get('pool', {}).get('processes', [])),
            'total_tasks': worker_stats.get('total', 0)
        }
        
        # Check for issues
        if worker_health['processes'] == 0:
            worker_health['status'] = 'unhealthy'
            health_report['issues'].append(f'{worker_name}: No processes')
        
        health_report['workers'][worker_name] = worker_health
    
    return health_report


${config.enableMonitoring ? `
@app.task(queue='monitoring')
def start_monitoring() -> None:
    """Start periodic monitoring tasks."""
    # Schedule periodic health checks
    health_check.apply_async(countdown=60, expires=120)
    
    # Schedule metric collection
    collect_metrics.apply_async(countdown=30, expires=60)
    
    # Schedule queue monitoring
    monitor_queue_lengths.apply_async(countdown=15, expires=30)
    
    logger.info("Monitoring tasks started")


@app.task(queue='monitoring')
def stop_monitoring() -> None:
    """Stop monitoring tasks."""
    # Cancel scheduled monitoring tasks
    # Implementation depends on your task tracking
    logger.info("Monitoring tasks stopped")
` : ''}


# Helper functions
import json


def get_task_metrics() -> Dict[str, Any]:
    """Get aggregated task metrics."""
    # Implementation depends on your metrics storage
    return {}


def store_metrics(metrics: Dict[str, Any]) -> None:
    """Store metrics in time series database."""
    key = f'celery_metrics:{datetime.utcnow().strftime("%Y%m%d%H%M")}'
    redis_client.setex(key, 3600, json.dumps(metrics))


def update_task_aggregates(task_name: str, execution_time: float, success: bool) -> None:
    """Update aggregated task metrics."""
    key = f'task_aggregates:{task_name}'
    
    # Get current aggregates
    data = redis_client.get(key)
    if data:
        aggregates = json.loads(data)
    else:
        aggregates = {
            'count': 0,
            'total_time': 0,
            'successful': 0,
            'failed': 0,
            'min_time': float('inf'),
            'max_time': 0
        }
    
    # Update aggregates
    aggregates['count'] += 1
    aggregates['total_time'] += execution_time
    aggregates['successful' if success else 'failed'] += 1
    aggregates['min_time'] = min(aggregates['min_time'], execution_time)
    aggregates['max_time'] = max(aggregates['max_time'], execution_time)
    
    # Store updated aggregates
    redis_client.set(key, json.dumps(aggregates))


def get_task_threshold(task_name: str) -> float:
    """Get performance threshold for task."""
    thresholds = {
        'tasks.email_tasks.send_email': 5.0,
        'tasks.data_tasks.process_csv_file': 30.0,
        'tasks.notification_tasks.send_push_notification': 2.0
    }
    return thresholds.get(task_name, 10.0)


def alert_slow_task(
    task_name: str,
    execution_time: float,
    args: Optional[tuple],
    kwargs: Optional[dict]
) -> None:
    """Send alert for slow task execution."""
    alert = {
        'type': 'slow_task',
        'task_name': task_name,
        'execution_time': execution_time,
        'threshold': get_task_threshold(task_name),
        'args': str(args),
        'kwargs': str(kwargs),
        'timestamp': datetime.utcnow().isoformat()
    }
    
    # Store alert
    key = f'alerts:{datetime.utcnow().strftime("%Y%m%d")}'
    redis_client.lpush(key, json.dumps(alert))
    redis_client.expire(key, 86400 * 7)


def get_task_performance_data(start_dt: datetime, end_dt: datetime) -> Dict[str, Any]:
    """Get task performance data for period."""
    # Implementation depends on your metrics storage
    return {}


def get_worker_statistics(start_dt: datetime, end_dt: datetime) -> Dict[str, Any]:
    """Get worker statistics for period."""
    # Implementation depends on your metrics storage
    return {}


def get_error_summary(start_dt: datetime, end_dt: datetime) -> List[Dict[str, Any]]:
    """Get error summary for period."""
    # Implementation depends on your error tracking
    return []


def store_performance_report(report: Dict[str, Any]) -> None:
    """Store performance report."""
    key = f'performance_report:{datetime.utcnow().strftime("%Y%m%d%H%M%S")}'
    redis_client.setex(key, 86400 * 30, json.dumps(report))  # 30 days retention


def send_queue_alert(queue_name: str, length: int) -> None:
    """Send alert for long queue."""
    alert = {
        'type': 'long_queue',
        'queue': queue_name,
        'length': length,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    # Send notification
    from .notification_tasks import send_push_notification
    send_push_notification.delay(
        'admin',
        'Queue Alert',
        f'Queue {queue_name} has {length} pending tasks',
        {'alert': alert}
    )


def store_queue_metrics(queue_lengths: Dict[str, int]) -> None:
    """Store queue length metrics."""
    key = f'queue_metrics:{datetime.utcnow().strftime("%Y%m%d%H%M")}'
    redis_client.setex(key, 3600, json.dumps(queue_lengths))
`;
  }

  protected generateScheduledTasks(config: CeleryConfig): string {
    return `"""
Scheduled and periodic tasks configuration.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict

from celery import current_app
from celery.schedules import crontab

from ..celery_app import app
from ..tasks import email_tasks, data_tasks, notification_tasks, monitoring


# Configure periodic tasks
app.conf.beat_schedule = {
    # Health monitoring
    'health-check-every-minute': {
        'task': 'tasks.monitoring.health_check',
        'schedule': 60.0,  # Every minute
        'options': {
            'queue': 'monitoring',
            'priority': 10
        }
    },
    
    # Metrics collection
    'collect-metrics-every-5-minutes': {
        'task': 'tasks.monitoring.collect_metrics',
        'schedule': 300.0,  # Every 5 minutes
        'options': {
            'queue': 'monitoring',
            'priority': 8
        }
    },
    
    # Queue monitoring
    'monitor-queues-every-2-minutes': {
        'task': 'tasks.monitoring.monitor_queue_lengths',
        'schedule': 120.0,  # Every 2 minutes
        'options': {
            'queue': 'monitoring',
            'priority': 9
        }
    },
    
    # Daily cleanup
    'cleanup-old-metrics-daily': {
        'task': 'tasks.monitoring.cleanup_old_metrics',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
        'args': (7,),  # 7 days retention
        'options': {
            'queue': 'monitoring',
            'priority': 5
        }
    },
    
    # Daily performance report
    'generate-daily-performance-report': {
        'task': 'tasks.monitoring.generate_performance_report',
        'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM
        'options': {
            'queue': 'monitoring',
            'priority': 6
        }
    },
    
    # Worker health check
    'check-worker-health-every-10-minutes': {
        'task': 'tasks.monitoring.check_worker_health',
        'schedule': 600.0,  # Every 10 minutes
        'options': {
            'queue': 'monitoring',
            'priority': 9
        }
    },
    
    # Send daily digest emails
    'send-daily-digest-emails': {
        'task': 'tasks.scheduled.send_daily_digests',
        'schedule': crontab(hour=9, minute=0),  # Daily at 9 AM
        'options': {
            'queue': 'emails',
            'priority': 7
        }
    },
    
    # Process pending notifications
    'process-pending-notifications': {
        'task': 'tasks.scheduled.process_pending_notifications',
        'schedule': 60.0,  # Every minute
        'options': {
            'queue': 'notifications',
            'priority': 8
        }
    },
    
    # Data aggregation
    'aggregate-daily-data': {
        'task': 'tasks.scheduled.aggregate_daily_data',
        'schedule': crontab(hour=1, minute=0),  # Daily at 1 AM
        'options': {
            'queue': 'data_processing',
            'priority': 6
        }
    },
    
    # Weekly reports
    'generate-weekly-reports': {
        'task': 'tasks.scheduled.generate_weekly_reports',
        'schedule': crontab(
            day_of_week=1,  # Monday
            hour=6,
            minute=0
        ),
        'options': {
            'queue': 'data_processing',
            'priority': 7
        }
    },
    
    # Monthly cleanup
    'monthly-data-cleanup': {
        'task': 'tasks.scheduled.cleanup_old_data',
        'schedule': crontab(
            day_of_month=1,  # First day of month
            hour=4,
            minute=0
        ),
        'options': {
            'queue': 'data_processing',
            'priority': 5
        }
    }
}


@app.task(queue='emails')
def send_daily_digests() -> Dict[str, Any]:
    """Send daily digest emails to subscribed users."""
    # Get subscribed users
    users = get_digest_subscribers()
    
    # Generate digest content
    digest_date = datetime.utcnow().date()
    
    # Create email tasks for each user
    tasks_created = 0
    for user in users:
        digest_content = generate_user_digest(user['id'], digest_date)
        
        if digest_content:
            email_tasks.send_email.delay(
                to=user['email'],
                subject=f'Your Daily Digest - {digest_date}',
                body=digest_content['text'],
                html_body=digest_content['html']
            )
            tasks_created += 1
    
    return {
        'status': 'completed',
        'digest_date': str(digest_date),
        'emails_sent': tasks_created,
        'total_subscribers': len(users)
    }


@app.task(queue='notifications')
def process_pending_notifications() -> Dict[str, Any]:
    """Process pending scheduled notifications."""
    # Get pending notifications
    pending = get_pending_notifications()
    
    processed = 0
    failed = 0
    
    for notification in pending:
        try:
            # Determine notification type and send
            if notification['type'] == 'push':
                notification_tasks.send_push_notification.delay(
                    **notification['params']
                )
            elif notification['type'] == 'email':
                email_tasks.send_notification_email.delay(
                    **notification['params']
                )
            elif notification['type'] == 'sms':
                notification_tasks.send_sms_notification.delay(
                    **notification['params']
                )
            
            # Mark as processed
            mark_notification_processed(notification['id'])
            processed += 1
            
        except Exception as exc:
            logger.error(f"Failed to process notification {notification['id']}: {exc}")
            failed += 1
    
    return {
        'status': 'completed',
        'processed': processed,
        'failed': failed,
        'total': len(pending)
    }


@app.task(queue='data_processing')
def aggregate_daily_data() -> Dict[str, Any]:
    """Aggregate data for the previous day."""
    # Calculate yesterday's date
    yesterday = datetime.utcnow().date() - timedelta(days=1)
    
    # Define aggregation tasks
    aggregations = [
        {
            'name': 'user_activity',
            'sources': ['app_events', 'web_events'],
            'group_by': ['user_id', 'event_type'],
            'aggregations': {
                'count': 'count',
                'duration': 'sum'
            }
        },
        {
            'name': 'transaction_summary',
            'sources': ['transactions'],
            'group_by': ['type', 'status'],
            'aggregations': {
                'amount': 'sum',
                'count': 'count'
            }
        },
        {
            'name': 'performance_metrics',
            'sources': ['api_logs'],
            'group_by': ['endpoint', 'method'],
            'aggregations': {
                'response_time': 'avg',
                'requests': 'count'
            }
        }
    ]
    
    results = []
    
    for agg_config in aggregations:
        # Create aggregation task
        result = data_tasks.aggregate_data.delay(
            data_sources=[f"{s}_{yesterday}" for s in agg_config['sources']],
            aggregation_config=agg_config
        )
        
        results.append({
            'aggregation': agg_config['name'],
            'task_id': result.id
        })
    
    return {
        'status': 'processing',
        'date': str(yesterday),
        'aggregations': results
    }


@app.task(queue='data_processing')
def generate_weekly_reports() -> Dict[str, Any]:
    """Generate weekly reports."""
    # Calculate week period
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=7)
    
    report_types = [
        'user_engagement',
        'revenue_summary',
        'system_performance',
        'error_analysis'
    ]
    
    generated_reports = []
    
    for report_type in report_types:
        # Generate report
        result = data_tasks.generate_report.delay(
            report_type=report_type,
            parameters={
                'start_date': str(start_date),
                'end_date': str(end_date),
                'format': 'pdf',
                'notify_on_completion': True,
                'recipients': get_report_recipients(report_type)
            }
        )
        
        generated_reports.append({
            'type': report_type,
            'task_id': result.id
        })
    
    return {
        'status': 'generating',
        'period': {
            'start': str(start_date),
            'end': str(end_date)
        },
        'reports': generated_reports
    }


@app.task(queue='data_processing')
def cleanup_old_data() -> Dict[str, Any]:
    """Clean up old data based on retention policies."""
    retention_policies = {
        'logs': 30,  # 30 days
        'temp_files': 7,  # 7 days
        'user_sessions': 90,  # 90 days
        'analytics_raw': 180,  # 180 days
        'notifications': 30,  # 30 days
    }
    
    cleanup_results = {}
    
    for data_type, retention_days in retention_policies.items():
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        try:
            deleted_count = cleanup_data_type(data_type, cutoff_date)
            cleanup_results[data_type] = {
                'status': 'success',
                'deleted': deleted_count,
                'cutoff_date': str(cutoff_date.date())
            }
        except Exception as exc:
            logger.error(f"Failed to cleanup {data_type}: {exc}")
            cleanup_results[data_type] = {
                'status': 'failed',
                'error': str(exc)
            }
    
    # Run storage optimization
    optimize_storage()
    
    return {
        'status': 'completed',
        'timestamp': datetime.utcnow().isoformat(),
        'results': cleanup_results
    }


@app.task(queue='emails')
def send_reminder_emails() -> Dict[str, Any]:
    """Send reminder emails for various events."""
    reminders = [
        {
            'type': 'abandoned_cart',
            'delay_hours': 24,
            'template': 'abandoned_cart_reminder'
        },
        {
            'type': 'incomplete_profile',
            'delay_hours': 72,
            'template': 'complete_profile_reminder'
        },
        {
            'type': 'subscription_expiring',
            'days_before': 7,
            'template': 'subscription_reminder'
        }
    ]
    
    total_sent = 0
    
    for reminder in reminders:
        users = get_users_for_reminder(reminder)
        
        for user in users:
            context = generate_reminder_context(user, reminder)
            
            email_tasks.send_notification_email.delay(
                user_id=user['id'],
                notification_type=reminder['type'],
                context=context
            )
            
            total_sent += 1
    
    return {
        'status': 'completed',
        'reminders_sent': total_sent,
        'types': [r['type'] for r in reminders]
    }


# Helper functions
def get_digest_subscribers() -> List[Dict[str, Any]]:
    """Get users subscribed to daily digest."""
    # Implementation depends on your user service
    return []


def generate_user_digest(user_id: str, date: Any) -> Dict[str, str]:
    """Generate digest content for user."""
    # Implementation depends on your content
    return {
        'text': f'Daily digest for {date}',
        'html': f'<h1>Daily Digest - {date}</h1>'
    }


def get_pending_notifications() -> List[Dict[str, Any]]:
    """Get pending scheduled notifications."""
    # Implementation depends on your notification storage
    return []


def mark_notification_processed(notification_id: str) -> None:
    """Mark notification as processed."""
    # Implementation depends on your notification storage
    pass


def get_report_recipients(report_type: str) -> List[str]:
    """Get recipients for report type."""
    # Implementation depends on your configuration
    return []


def cleanup_data_type(data_type: str, cutoff_date: datetime) -> int:
    """Clean up specific data type older than cutoff."""
    # Implementation depends on your data storage
    return 0


def optimize_storage() -> None:
    """Optimize storage after cleanup."""
    # Implementation depends on your storage system
    pass


def get_users_for_reminder(reminder: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Get users eligible for reminder."""
    # Implementation depends on your user criteria
    return []


def generate_reminder_context(user: Dict[str, Any], reminder: Dict[str, Any]) -> Dict[str, Any]:
    """Generate context for reminder email."""
    return {
        'user': user,
        'reminder_type': reminder['type']
    }


import logging
logger = logging.getLogger(__name__)
`;
  }

  protected generateCeleryDockerfile(config: CeleryConfig): string {
    return `FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    g++ \\
    libpq-dev \\
    redis-tools \\
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install Celery and dependencies
RUN pip install --no-cache-dir \\
    celery[redis]==5.3.* \\
    flower==2.0.* \\
    ${config.enableMonitoring ? 'celery-prometheus-exporter==1.7.*' : ''} \\
    psutil==5.9.* \\
    pandas==2.1.* \\
    requests==2.31.*

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m celery && chown -R celery:celery /app
USER celery

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD celery -A celery_app inspect ping || exit 1

# Default command for worker
CMD ["celery", "-A", "celery_app", "worker", "--loglevel=info"]
`;
  }

  protected generateSupervisorConfig(config: CeleryConfig): string {
    return `[program:celery-worker]
command=celery -A celery_app worker --loglevel=info --concurrency=4
directory=/app
user=celery
numprocs=1
stdout_logfile=/var/log/celery/worker.log
stderr_logfile=/var/log/celery/worker.err
autostart=true
autorestart=true
startsecs=10
stopwaitsecs=600
stopasgroup=true
priority=998

[program:celery-beat]
command=celery -A celery_app beat --loglevel=info
directory=/app
user=celery
numprocs=1
stdout_logfile=/var/log/celery/beat.log
stderr_logfile=/var/log/celery/beat.err
autostart=${config.enableScheduling ? 'true' : 'false'}
autorestart=true
startsecs=10
priority=999

[program:celery-flower]
command=celery -A celery_app flower --port=5555
directory=/app
user=celery
numprocs=1
stdout_logfile=/var/log/celery/flower.log
stderr_logfile=/var/log/celery/flower.err
autostart=${config.enableMonitoring ? 'true' : 'false'}
autorestart=true
startsecs=10
priority=997

[group:celery]
programs=celery-worker,celery-beat,celery-flower
priority=999
`;
  }

  private getFrameworkImports(framework: string): string {
    const imports: { [key: string]: string } = {
      'fastapi': `from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession`,
      'django': `from django.conf import settings
from django.db import connection`,
      'flask': `from flask import Flask, current_app
from flask_sqlalchemy import SQLAlchemy`,
      'tornado': `import tornado.ioloop
from tornado import gen`,
      'sanic': `from sanic import Sanic
from sanic.response import json as sanic_json`
    };
    return imports[framework] || '';
  }

  private getFrameworkIntegration(framework: string): string {
    const integrations: { [key: string]: string } = {
      'fastapi': `# FastAPI integration
if hasattr(app.conf, 'fastapi_app'):
    fastapi_app = app.conf.fastapi_app
    
    @fastapi_app.on_event("startup")
    async def startup_event():
        """Initialize Celery on FastAPI startup."""
        app.control.purge()
        logger.info("Celery initialized with FastAPI")`,
      
      'django': `# Django integration
if 'django' in sys.modules:
    import django
    django.setup()
    
    # Use Django settings for Celery configuration
    app.config_from_object('django.conf:settings', namespace='CELERY')
    app.autodiscover_tasks()`,
      
      'flask': `# Flask integration
def init_celery(flask_app: Flask):
    """Initialize Celery with Flask app context."""
    app.conf.update(flask_app.config)
    
    class ContextTask(app.Task):
        def __call__(self, *args, **kwargs):
            with flask_app.app_context():
                return self.run(*args, **kwargs)
    
    app.Task = ContextTask
    return app`,
      
      'tornado': `# Tornado integration
def make_celery_async(tornado_app):
    """Make Celery tasks work with Tornado IOLoop."""
    from tornado import gen
    
    class TornadoTask(app.Task):
        @gen.coroutine
        def apply_async(self, *args, **kwargs):
            result = super().apply_async(*args, **kwargs)
            raise gen.Return(result)
    
    app.Task = TornadoTask
    return app`,
      
      'sanic': `# Sanic integration
def init_celery_sanic(sanic_app: Sanic):
    """Initialize Celery with Sanic app."""
    app.conf.update(sanic_app.config)
    
    @sanic_app.listener('before_server_start')
    async def setup_celery(app, loop):
        logger.info("Celery initialized with Sanic")`
    };
    
    return integrations[framework] || '';
  }

  protected generateTaskRouting(): string {
    return `# Task routing configuration
app.conf.task_routes = {
    'tasks.email_tasks.*': {'queue': 'emails'},
    'tasks.data_tasks.*': {'queue': 'data_processing'},
    'tasks.notification_tasks.*': {'queue': 'notifications'},
    'tasks.monitoring.*': {'queue': 'monitoring'},
    'tasks.scheduled.*': {'queue': 'default'}}

# Priority routing
app.conf.task_route = {
    'tasks.email_tasks.send_transactional_email': {
        'queue': 'high_priority',
        'priority': 10
    },
    'tasks.notification_tasks.send_push_notification': {
        'queue': 'high_priority',
        'priority': 9
    },
    'tasks.data_tasks.etl_pipeline': {
        'queue': 'low_priority',
        'priority': 3
    }
}`;
  }

  protected generateResultBackend(): string {
    return `# Result backend configuration
app.conf.result_backend = 'redis://localhost:6379/1'
app.conf.result_expires = 3600  # 1 hour
app.conf.result_persistent = True
app.conf.result_compression = 'gzip'
app.conf.result_serializer = 'json'
app.conf.result_backend_transport_options = {
    'master_name': 'mymaster',
    'visibility_timeout': 3600,
    'fanout_prefix': True,
    'fanout_patterns': True
}`;
  }

  protected generateCeleryConfigFile(config: CeleryConfig): string {
    return `"""
Celery configuration file.
"""
import os

# Broker settings
broker_url = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
result_backend = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')

# Task execution settings
task_serializer = 'json'
accept_content = ['json']
result_serializer = 'json'
timezone = 'UTC'
enable_utc = True

# Worker settings
worker_prefetch_multiplier = 4
worker_max_tasks_per_child = 1000
worker_disable_rate_limits = False

# Task time limits
task_time_limit = 300  # 5 minutes
task_soft_time_limit = 240  # 4 minutes

# Task result settings
result_expires = 3600  # 1 hour
result_persistent = True
result_compression = 'gzip'

# Queue definitions
task_default_queue = 'default'
task_create_missing_queues = True

# Beat schedule timezone
beat_schedule_timezone = 'UTC'

# Monitoring
worker_send_task_events = True
task_send_sent_event = True

# Error handling
task_reject_on_worker_lost = True
task_ignore_result = False

# Security
worker_hijack_root_logger = False
worker_log_color = False

# Performance
task_compression = 'gzip'
${config.enableResultBackend ? "result_backend_transport_options = {'visibility_timeout': 3600}" : ''}
`;
  }

  protected generateMonitoringSignals(): string {
    return `# Monitoring signal handlers
@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, **kw):
    """Log task start."""
    logger.info(f'Task {task.name} [{task_id}] started')
    # Store start time for performance monitoring
    redis_client.set(f'task_start:{task_id}', datetime.utcnow().timestamp())


@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, retval=None, state=None, **kw):
    """Log task completion and monitor performance."""
    # Calculate execution time
    start_time = redis_client.get(f'task_start:{task_id}')
    if start_time:
        execution_time = datetime.utcnow().timestamp() - float(start_time)
        redis_client.delete(f'task_start:{task_id}')
        
        # Monitor performance
        from tasks.monitoring import monitor_task_performance
        monitor_task_performance.delay(
            task_name=task.name,
            execution_time=execution_time,
            success=state == 'SUCCESS',
            args=args,
            kwargs=kwargs
        )
    
    logger.info(f'Task {task.name} [{task_id}] completed with state: {state}')


@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, args=None, kwargs=None, traceback=None, einfo=None, **kw):
    """Handle task failures."""
    logger.error(f'Task {sender.name} [{task_id}] failed: {exception}')
    
    # Store failure for analysis
    failure_data = {
        'task_name': sender.name,
        'task_id': task_id,
        'exception': str(exception),
        'args': str(args),
        'kwargs': str(kwargs),
        'timestamp': datetime.utcnow().isoformat()
    }
    
    key = f'task_failures:{datetime.utcnow().strftime("%Y%m%d")}'
    redis_client.lpush(key, json.dumps(failure_data))
    redis_client.expire(key, 86400 * 7)  # 7 days retention


@task_retry.connect
def task_retry_handler(sender=None, task_id=None, reason=None, einfo=None, **kw):
    """Handle task retries."""
    logger.warning(f'Task {sender.name} [{task_id}] retrying: {reason}')


@task_success.connect
def task_success_handler(sender=None, result=None, **kw):
    """Handle successful task completion."""
    logger.debug(f'Task {sender.name} completed successfully')


@after_setup_logger.connect
def setup_loggers(sender=None, logger=None, loglevel=None, logfile=None, format=None, colorize=None, **kw):
    """Configure logging."""
    # Add custom formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Add file handler for persistent logs
    file_handler = logging.FileHandler('celery.log')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)


import json
import logging
from datetime import datetime`;
  }
}

export const pythonCeleryTasksGenerator = new CeleryTaskGenerator();