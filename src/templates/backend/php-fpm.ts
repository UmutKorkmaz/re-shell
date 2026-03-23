export interface PhpFpmConfig {
  projectName: string;
  port?: number;
  phpVersion?: string;
  environment?: 'development' | 'production';
  maxChildren?: number;
  startServers?: number;
  minSpareServers?: number;
  maxSpareServers?: number;
  maxRequests?: number;
  slowlogTimeout?: number;
  requestTimeout?: number;
}

export class PhpFpmGenerator {
  generateFpmConfig(config: PhpFpmConfig): { path: string; content: string }[] {
    const {
      projectName,
      port = 9000,
      phpVersion = '8.2',
      environment = 'development',
      maxChildren = environment === 'development' ? 5 : 50,
      startServers = environment === 'development' ? 2 : 5,
      minSpareServers = environment === 'development' ? 1 : 5,
      maxSpareServers = environment === 'development' ? 3 : 35,
      maxRequests = environment === 'development' ? 500 : 10000,
      slowlogTimeout = 10,
      requestTimeout = 600
    } = config;

    const files: { path: string; content: string }[] = [];

    // PHP-FPM pool configuration
    files.push({
      path: 'docker/php-fpm/pool.d/www.conf',
      content: `[${projectName}]
; Unix user/group of processes
user = www-data
group = www-data

; The address on which to accept FastCGI requests
listen = 0.0.0.0:${port}

; Choose how the process manager will control the number of child processes
pm = dynamic

; The number of child processes to be created when pm is set to 'static'
pm.max_children = ${maxChildren}

; The number of child processes created on startup
pm.start_servers = ${startServers}

; The desired minimum number of idle server processes
pm.min_spare_servers = ${minSpareServers}

; The desired maximum number of idle server processes
pm.max_spare_servers = ${maxSpareServers}

; The number of requests each child process should execute before respawning
pm.max_requests = ${maxRequests}

; The URI to view the FPM status page
pm.status_path = /status

; The ping URI to call the monitoring page of FPM
ping.path = /ping

; The timeout for serving a single request
request_terminate_timeout = ${requestTimeout}

; The timeout for serving a single request after which a PHP backtrace will be dumped
request_slowlog_timeout = ${slowlogTimeout}s

; The log file for slow requests
slowlog = /var/log/php-fpm/slow.log

; Set open file descriptor rlimit
rlimit_files = 1024

; Set max core size rlimit
rlimit_core = 0

; Chdir to this directory at the start
chdir = /var/www

; Redirect worker stdout and stderr into main error log
catch_workers_output = yes

; Clear environment in FPM workers
clear_env = no

; Ensure worker stdout and stderr are sent to the main error log
php_admin_value[error_log] = /var/log/php-fpm/error.log
php_admin_flag[log_errors] = on

; Development specific settings
${environment === 'development' ? `
; Enable display errors for development
php_flag[display_errors] = on
php_flag[display_startup_errors] = on
php_value[error_reporting] = E_ALL

; Enable opcache for development
php_admin_value[opcache.enable] = 1
php_admin_value[opcache.validate_timestamps] = 1
php_admin_value[opcache.revalidate_freq] = 0
` : `
; Production settings
php_flag[display_errors] = off
php_flag[display_startup_errors] = off
php_value[error_reporting] = E_ALL & ~E_DEPRECATED & ~E_STRICT

; Enable opcache for production
php_admin_value[opcache.enable] = 1
php_admin_value[opcache.validate_timestamps] = 0
php_admin_value[opcache.max_accelerated_files] = 10000
php_admin_value[opcache.memory_consumption] = 128
`}

; Memory and execution limits
php_admin_value[memory_limit] = 256M
php_admin_value[max_execution_time] = 300
php_admin_value[max_input_time] = 300
php_admin_value[post_max_size] = 100M
php_admin_value[upload_max_filesize] = 100M
php_admin_value[max_file_uploads] = 20

; Session configuration
php_admin_value[session.save_handler] = files
php_admin_value[session.save_path] = /var/lib/php/sessions
php_admin_value[session.gc_probability] = 1
php_admin_value[session.gc_divisor] = 1000
php_admin_value[session.gc_maxlifetime] = 1440

; Security settings
php_admin_value[expose_php] = off
php_admin_value[cgi.fix_pathinfo] = 0
php_admin_value[disable_functions] = ${environment === 'production' ? 'exec,passthru,shell_exec,system,proc_open,popen,curl_exec,curl_multi_exec,parse_ini_file,show_source' : ''}

; Environment variables
env[HOSTNAME] = $HOSTNAME
env[PATH] = /usr/local/bin:/usr/bin:/bin
env[TMP] = /tmp
env[TMPDIR] = /tmp
env[TEMP] = /tmp`
    });

    // PHP-FPM main configuration
    files.push({
      path: 'docker/php-fpm/php-fpm.conf',
      content: `[global]
; Pid file
pid = /var/run/php-fpm.pid

; Error log file
error_log = /var/log/php-fpm/error.log

; Log level
log_level = ${environment === 'development' ? 'debug' : 'notice'}

; Log limit
log_limit = 4096

; If this number of child processes exit with SIGSEGV or SIGBUS
emergency_restart_threshold = 10

; ... within this time interval
emergency_restart_interval = 1m

; Time limit for child processes to wait for a reaction on signals
process_control_timeout = 10s

; The maximum number of processes FPM will fork
process.max = 128

; Maximum number of requests before reloading
process.max_requests = ${maxRequests}

; Send FPM to background
daemonize = no

; Set permissions for unix socket
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

; Include pool configurations
include=/usr/local/etc/php-fpm.d/*.conf`
    });

    // PHP configuration
    files.push({
      path: 'docker/php-fpm/php.ini',
      content: `[PHP]
; Basic settings
engine = On
short_open_tag = Off
precision = 14
output_buffering = 4096
zlib.output_compression = Off
implicit_flush = Off
unserialize_callback_func =
serialize_precision = -1
zend.enable_gc = On
expose_php = Off

; Resource Limits
max_execution_time = ${requestTimeout}
max_input_time = 300
max_input_vars = 1000
memory_limit = 256M

; Error handling and logging
error_reporting = ${environment === 'development' ? 'E_ALL' : 'E_ALL & ~E_DEPRECATED & ~E_STRICT'}
display_errors = ${environment === 'development' ? 'On' : 'Off'}
display_startup_errors = ${environment === 'development' ? 'On' : 'Off'}
log_errors = On
log_errors_max_len = 1024
ignore_repeated_errors = Off
ignore_repeated_source = Off
report_memleaks = On
html_errors = On
error_log = /var/log/php/error.log

; Data Handling
variables_order = "GPCS"
request_order = "GP"
register_argc_argv = Off
auto_globals_jit = On
post_max_size = 100M
auto_prepend_file =
auto_append_file =
default_mimetype = "text/html"
default_charset = "UTF-8"

; Paths and Directories
doc_root =
user_dir =
enable_dl = Off
cgi.fix_pathinfo = 0

; File Uploads
file_uploads = On
upload_tmp_dir = /tmp
upload_max_filesize = 100M
max_file_uploads = 20

; Fopen wrappers
allow_url_fopen = On
allow_url_include = Off
default_socket_timeout = 60

; Performance tuning
realpath_cache_size = 4096k
realpath_cache_ttl = 120

[CLI Server]
cli_server.color = On

[Date]
date.timezone = UTC

[filter]
filter.default = unsafe_raw
filter.default_flags =

[iconv]
iconv.input_encoding = UTF-8
iconv.internal_encoding = UTF-8
iconv.output_encoding = UTF-8

[intl]
intl.default_locale = en_US
intl.error_level = E_WARNING

[sqlite3]
sqlite3.defensive = 1

[Pcre]
pcre.backtrack_limit = 1000000
pcre.recursion_limit = 100000
pcre.jit = 1

[Pdo_mysql]
pdo_mysql.default_socket =

[mail function]
SMTP = localhost
smtp_port = 25
mail.add_x_header = Off

[ODBC]
odbc.allow_persistent = On
odbc.check_persistent = On
odbc.max_persistent = -1
odbc.max_links = -1
odbc.defaultlrl = 4096
odbc.defaultbinmode = 1

[MySQLi]
mysqli.max_persistent = -1
mysqli.allow_persistent = On
mysqli.max_links = -1
mysqli.default_port = 3306
mysqli.default_socket =
mysqli.default_host =
mysqli.default_user =
mysqli.default_pw =
mysqli.reconnect = Off

[mysqlnd]
mysqlnd.collect_statistics = On
mysqlnd.collect_memory_statistics = Off

[OCI8]
oci8.privileged_connect = Off
oci8.max_persistent = -1
oci8.persistent_timeout = -1
oci8.ping_interval = 60
oci8.connection_class =
oci8.events = Off
oci8.statement_cache_size = 20
oci8.default_prefetch = 100
oci8.old_oci_close_semantics = Off

[PostgreSQL]
pgsql.allow_persistent = On
pgsql.auto_reset_persistent = Off
pgsql.max_persistent = -1
pgsql.max_links = -1
pgsql.ignore_notice = 0
pgsql.log_notice = 0

[bcmath]
bcmath.scale = 0

[browscap]
browscap = /etc/php/browscap.ini

[Session]
session.save_handler = files
session.save_path = "/var/lib/php/sessions"
session.use_strict_mode = 0
session.use_cookies = 1
session.use_only_cookies = 1
session.name = PHPSESSID
session.auto_start = 0
session.cookie_lifetime = 0
session.cookie_path = /
session.cookie_domain =
session.cookie_httponly = 1
session.cookie_samesite =
session.serialize_handler = php
session.gc_probability = 1
session.gc_divisor = 1000
session.gc_maxlifetime = 1440
session.referer_check =
session.cache_limiter = nocache
session.cache_expire = 180
session.use_trans_sid = 0
session.sid_length = 26
session.trans_sid_tags = "a=href,area=href,frame=src,form="
session.sid_bits_per_character = 5

[Assertion]
zend.assertions = ${environment === 'development' ? '1' : '-1'}

[mbstring]
mbstring.internal_encoding = UTF-8
mbstring.func_overload = 0

[gd]
gd.jpeg_ignore_warning = 1

[exif]
exif.encode_unicode = ISO-8859-15
exif.decode_unicode_motorola = UCS-2BE
exif.decode_unicode_intel = UCS-2LE
exif.encode_jis =
exif.decode_jis_motorola = JIS
exif.decode_jis_intel = JIS

[Tidy]
tidy.clean_output = Off

[soap]
soap.wsdl_cache_enabled = 1
soap.wsdl_cache_dir = "/tmp"
soap.wsdl_cache_ttl = 86400
soap.wsdl_cache_limit = 5

[ldap]
ldap.max_links = -1

[opcache]
opcache.enable = 1
opcache.enable_cli = ${environment === 'development' ? '1' : '0'}
opcache.memory_consumption = 128
opcache.interned_strings_buffer = 8
opcache.max_accelerated_files = 10000
opcache.max_wasted_percentage = 5
opcache.use_cwd = 1
opcache.validate_timestamps = ${environment === 'development' ? '1' : '0'}
opcache.revalidate_freq = ${environment === 'development' ? '0' : '2'}
opcache.revalidate_path = 0
opcache.save_comments = 1
opcache.enable_file_override = 0
opcache.optimization_level = 0x7FFFBFFF
opcache.inherited_hack = 1
opcache.dups_fix = 0
opcache.blacklist_filename =
opcache.max_file_size = 0
opcache.consistency_checks = 0
opcache.force_restart_timeout = 180
opcache.error_log =
opcache.log_verbosity_level = 1
opcache.preferred_memory_model =
opcache.protect_memory = 0
opcache.restrict_api =
opcache.mmap_base =
opcache.file_cache =
opcache.file_cache_only = 0
opcache.file_cache_consistency_checks = 1
opcache.file_cache_fallback = 1
opcache.huge_code_pages = 0
opcache.validate_permission = 0
opcache.validate_root = 0
opcache.opt_debug_level = 0
opcache.preload =
opcache.preload_user =
opcache.lockfile_path = /tmp
opcache.jit = ${environment === 'development' ? 'off' : 'tracing'}
opcache.jit_buffer_size = ${environment === 'development' ? '0' : '100M'}`
    });

    // Dockerfile for PHP-FPM
    files.push({
      path: 'docker/php-fpm/Dockerfile',
      content: `FROM php:${phpVersion}-fpm-alpine

# Install system dependencies
RUN apk add --no-cache \\
    git \\
    curl \\
    libpng-dev \\
    libxml2-dev \\
    zip \\
    unzip \\
    oniguruma-dev \\
    postgresql-dev \\
    icu-dev \\
    freetype-dev \\
    libjpeg-turbo-dev \\
    libwebp-dev \\
    libzip-dev \\
    ${phpVersion === '8.2' || phpVersion === '8.3' ? 'linux-headers' : ''}

# Install PHP extensions
RUN docker-php-ext-configure gd \\
    --with-freetype \\
    --with-jpeg \\
    --with-webp \\
    && docker-php-ext-install \\
    pdo \\
    pdo_mysql \\
    pdo_pgsql \\
    mbstring \\
    exif \\
    pcntl \\
    bcmath \\
    gd \\
    zip \\
    intl \\
    opcache \\
    ${phpVersion === '8.2' || phpVersion === '8.3' ? 'sockets' : ''}

# Install Redis extension
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \\
    && pecl install redis \\
    && docker-php-ext-enable redis \\
    && apk del .build-deps

# Install APCu extension
RUN pecl install apcu \\
    && docker-php-ext-enable apcu

# Install Xdebug for development
${environment === 'development' ? `RUN pecl install xdebug \\
    && docker-php-ext-enable xdebug` : ''}

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Create necessary directories
RUN mkdir -p /var/log/php-fpm /var/lib/php/sessions \\
    && chown -R www-data:www-data /var/log/php-fpm /var/lib/php/sessions

# Copy PHP-FPM configuration
COPY php-fpm.conf /usr/local/etc/php-fpm.conf
COPY pool.d/www.conf /usr/local/etc/php-fpm.d/www.conf
COPY php.ini /usr/local/etc/php/php.ini

# Set working directory
WORKDIR /var/www

# Expose PHP-FPM port
EXPOSE ${port}

# Start PHP-FPM
CMD ["php-fpm", "-F"]`
    });

    // Docker Compose configuration
    files.push({
      path: 'docker-compose.yml',
      content: `version: '3.8'

services:
  php-fpm:
    build:
      context: ./docker/php-fpm
      dockerfile: Dockerfile
      args:
        PHP_VERSION: ${phpVersion}
    container_name: ${projectName}_php_fpm
    restart: unless-stopped
    ports:
      - "${port}:9000"
    volumes:
      - .:/var/www
      - ./docker/php-fpm/php.ini:/usr/local/etc/php/php.ini
      - ./docker/php-fpm/pool.d/www.conf:/usr/local/etc/php-fpm.d/www.conf
      - php_sessions:/var/lib/php/sessions
      - php_logs:/var/log/php-fpm
    environment:
      - PHP_IDE_CONFIG=serverName=${projectName}
      ${environment === 'development' ? `- XDEBUG_MODE=develop,debug
      - XDEBUG_CONFIG=client_host=host.docker.internal client_port=9003` : ''}
    networks:
      - ${projectName}_network

  nginx:
    image: nginx:alpine
    container_name: ${projectName}_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - .:/var/www
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/sites:/etc/nginx/sites-available
      - nginx_logs:/var/log/nginx
    depends_on:
      - php-fpm
    networks:
      - ${projectName}_network

  ${environment === 'development' ? `adminer:
    image: adminer
    container_name: ${projectName}_adminer
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - ADMINER_DEFAULT_SERVER=mysql
      - ADMINER_DESIGN=pepa-linha-dark
    networks:
      - ${projectName}_network` : ''}

networks:
  ${projectName}_network:
    driver: bridge

volumes:
  php_sessions:
  php_logs:
  nginx_logs:`
    });

    // Nginx configuration for PHP-FPM
    files.push({
      path: 'docker/nginx/nginx.conf',
      content: `user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # Performance settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Include site configurations
    include /etc/nginx/sites-available/*.conf;
}`
    });

    // Site configuration for PHP application
    files.push({
      path: 'docker/nginx/sites/default.conf',
      content: `server {
    listen 80;
    listen [::]:80;
    server_name localhost;
    root /var/www/public;
    index index.php index.html index.htm;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    # PHP-FPM configuration
    location ~ \\.php$ {
        try_files $uri =404;
        fastcgi_split_path_info ^(.+\\.php)(/.+)$;
        fastcgi_pass php-fpm:9000;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
        fastcgi_buffering off;
        fastcgi_request_buffering off;
        fastcgi_read_timeout ${requestTimeout};
    }

    # Security for hidden files
    location ~ /\\. {
        deny all;
    }

    # Cache static assets
    location ~* \\.(jpg|jpeg|gif|png|css|js|ico|xml|rss|txt|woff|woff2|ttf|svg|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoints
    location /health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 "healthy\\n";
    }

    location /php-fpm-status {
        access_log off;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_pass php-fpm:9000;
        fastcgi_index index.php;
    }

    location /php-fpm-ping {
        access_log off;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_pass php-fpm:9000;
    }
}`
    });

    // Development helper script
    files.push({
      path: 'scripts/php-fpm-dev.sh',
      content: `#!/bin/bash

# Development helper script for PHP-FPM

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

# Functions
print_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start       Start PHP-FPM and Nginx"
    echo "  stop        Stop all containers"
    echo "  restart     Restart all containers"
    echo "  logs        Show logs (php-fpm, nginx)"
    echo "  shell       Enter PHP-FPM container shell"
    echo "  status      Show PHP-FPM status"
    echo "  reload      Reload PHP-FPM configuration"
    echo "  test        Run PHP-FPM configuration test"
    echo "  xdebug      Toggle Xdebug on/off"
    echo "  opcache     Clear OPcache"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "\${RED}Docker is not running!\${NC}"
    exit 1
fi

case "$1" in
    start)
        echo -e "\${GREEN}Starting PHP-FPM and Nginx...\${NC}"
        docker-compose up -d
        echo -e "\${GREEN}Services started successfully!\${NC}"
        echo "PHP-FPM: http://localhost:${port}"
        echo "Web: http://localhost"
        ${environment === 'development' ? 'echo "Adminer: http://localhost:8080"' : ''}
        ;;
    
    stop)
        echo -e "\${YELLOW}Stopping all containers...\${NC}"
        docker-compose down
        echo -e "\${GREEN}Services stopped!\${NC}"
        ;;
    
    restart)
        echo -e "\${YELLOW}Restarting containers...\${NC}"
        docker-compose restart
        echo -e "\${GREEN}Services restarted!\${NC}"
        ;;
    
    logs)
        case "$2" in
            php|php-fpm)
                docker-compose logs -f php-fpm
                ;;
            nginx)
                docker-compose logs -f nginx
                ;;
            *)
                docker-compose logs -f
                ;;
        esac
        ;;
    
    shell)
        echo -e "\${GREEN}Entering PHP-FPM container...\${NC}"
        docker-compose exec php-fpm sh
        ;;
    
    status)
        echo -e "\${GREEN}PHP-FPM Status:\${NC}"
        curl -s http://localhost/php-fpm-status
        ;;
    
    reload)
        echo -e "\${YELLOW}Reloading PHP-FPM configuration...\${NC}"
        docker-compose exec php-fpm kill -USR2 1
        echo -e "\${GREEN}Configuration reloaded!\${NC}"
        ;;
    
    test)
        echo -e "\${GREEN}Testing PHP-FPM configuration...\${NC}"
        docker-compose exec php-fpm php-fpm -t
        ;;
    
    ${environment === 'development' ? `xdebug)
        if docker-compose exec php-fpm php -m | grep -q xdebug; then
            echo -e "\${YELLOW}Disabling Xdebug...\${NC}"
            docker-compose exec php-fpm sh -c "rm -f /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini"
        else
            echo -e "\${GREEN}Enabling Xdebug...\${NC}"
            docker-compose exec php-fpm docker-php-ext-enable xdebug
        fi
        docker-compose restart php-fpm
        ;;` : ''}
    
    opcache)
        echo -e "\${YELLOW}Clearing OPcache...\${NC}"
        docker-compose exec php-fpm sh -c "echo '<?php opcache_reset(); echo "OPcache cleared\\n";' | php"
        echo -e "\${GREEN}OPcache cleared!\${NC}"
        ;;
    
    *)
        print_usage
        exit 1
        ;;
esac`
    });

    // Make script executable
    files.push({
      path: 'scripts/setup-permissions.sh',
      content: `#!/bin/bash
chmod +x scripts/php-fpm-dev.sh`
    });

    return files;
  }

  generateXdebugConfig(): string {
    return `[xdebug]
xdebug.mode = develop,debug,coverage
xdebug.start_with_request = yes
xdebug.client_host = host.docker.internal
xdebug.client_port = 9003
xdebug.log = /var/log/xdebug.log
xdebug.idekey = PHPSTORM`;
  }

  generateHealthCheck(): string {
    return `<?php
// Health check endpoint for PHP-FPM

header('Content-Type: application/json');

$health = [
    'status' => 'healthy',
    'timestamp' => date('c'),
    'php_version' => PHP_VERSION,
    'opcache' => function_exists('opcache_get_status') ? opcache_get_status(false) : null,
    'extensions' => get_loaded_extensions(),
    'memory' => [
        'current' => memory_get_usage(true),
        'peak' => memory_get_peak_usage(true),
        'limit' => ini_get('memory_limit')
    ]
];

http_response_code(200);
echo json_encode($health, JSON_PRETTY_PRINT);`;
  }
}

export function generatePhpFpmConfig(config: PhpFpmConfig): { path: string; content: string }[] {
  const generator = new PhpFpmGenerator();
  return generator.generateFpmConfig(config);
}