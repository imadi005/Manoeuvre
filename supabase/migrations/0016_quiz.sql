-- Live synchronized IT Manager (Blacktie Protocol) Round 1 quiz: 40 MCQs,
-- one shared timer, event-lead-triggered start, easter-egg media pool.
-- Run this in Supabase Dashboard -> SQL Editor.

-- Storage bucket for easter-egg images/GIFs. Public read, same pattern as
-- the existing event-photos bucket -- writes go through the service role
-- key regardless.
insert into storage.buckets (id, name, public)
values ('quiz-easter-eggs', 'quiz-easter-eggs', true)
on conflict (id) do nothing;

-- Singleton-per-event control row. started_at null = not started yet.
create table if not exists quiz_state (
  event_slug text primary key,
  duration_minutes int not null default 40,
  started_at timestamptz,
  closed_at timestamptz,
  started_by uuid references organizers(id) on delete set null
);

alter table quiz_state enable row level security;
-- No public policies -- server-side code only, via the service role key.

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  question_number int not null,
  section_label text,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  unique (event_slug, question_number)
);

alter table quiz_questions enable row level security;
-- No public policies -- server-side code only, via the service role key.

-- One row per student per question, upserted as they answer -- so a
-- refresh/reconnect never loses progress.
create table if not exists quiz_answers (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  student_id uuid not null references students(id) on delete cascade,
  question_number int not null,
  selected_option text not null check (selected_option in ('A','B','C','D')),
  answered_at timestamptz not null default now(),
  unique (event_slug, student_id, question_number)
);

alter table quiz_answers enable row level security;
-- No public policies -- server-side code only, via the service role key.

-- One row per student once they submit (manually or auto at time-up).
create table if not exists quiz_submissions (
  event_slug text not null,
  student_id uuid not null references students(id) on delete cascade,
  score int not null,
  submitted_at timestamptz not null default now(),
  primary key (event_slug, student_id)
);

alter table quiz_submissions enable row level security;
-- No public policies -- server-side code only, via the service role key.

-- Easter-egg media pool -- event lead uploads via a small form, client
-- shows one at a random point mid-quiz. Unscored on the site; the
-- "who is this" bonus round happens live/verbally afterward.
create table if not exists quiz_easter_eggs (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  storage_path text not null,
  uploaded_by uuid references organizers(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table quiz_easter_eggs enable row level security;
-- No public policies -- server-side code only, via the service role key.

-- ---------------------------------------------------------------------------
-- Question bank -- The Blacktie Protocol (IT Manager) Round 1, 40 questions.
-- ---------------------------------------------------------------------------

insert into quiz_questions (event_slug, question_number, section_label, question_text, option_a, option_b, option_c, option_d, correct_option) values
  ('blacktie-protocol', 1, 'Coding & Algorithms', 'When implementing a Hash Map, what is the theoretical worst-case time complexity for lookups if an unhandled hash collision scenario causes all keys to map to the same bucket (assuming standard linear chaining)?', 'O(1)', 'O(log N)', 'O(N)', 'O(N log N)', 'C'),
  ('blacktie-protocol', 2, 'Coding & Algorithms', 'In C/C++, why can using dynamic memory allocation (malloc or new) repeatedly in long-running embedded or high-throughput systems cause performance degradation over time?', 'It causes heap fragmentation, leading to allocation failures or cache misses.', 'It automatically forces CPU core context switches.', 'Dynamic allocation forces the compiler to run in single-threaded mode.', 'It converts stack pointers into immutable global memory spaces.', 'A'),
  ('blacktie-protocol', 3, 'Coding & Algorithms', 'What is the main difference between Breadth-First Search (BFS) and Depth-First Search (DFS) when traversing an unweighted graph?', 'BFS uses a Stack and finds paths with the maximum nodes; DFS uses a Queue.', 'BFS uses a Queue and guarantees finding the shortest path; DFS uses a Stack (or recursion) and explores as deep as possible before backtracking.', 'BFS operates in O(V+E) time, whereas DFS operates in O(V^2) time.', 'DFS can only be used on Directed Acyclic Graphs (DAGs), while BFS works on any graph.', 'B'),
  ('blacktie-protocol', 4, 'Coding & Algorithms', 'In SQL, what is the key difference between the WHERE clause and the HAVING clause?', 'WHERE filters individual rows before aggregation; HAVING filters aggregated group records after GROUP BY.', 'WHERE is used only in subqueries; HAVING is used only in top-level SELECT statements.', 'HAVING requires a primary key index; WHERE can run on unindexed columns.', 'WHERE modifies table data permanently; HAVING creates a read-only view.', 'A'),
  ('blacktie-protocol', 5, 'Coding & Algorithms', 'In object-oriented software architecture, what does the Single Responsibility Principle (SRP) mandate?', 'A class should have only one instance running across the entire application runtime (Singleton).', 'A class or module should have only one primary reason to change or be modified.', 'A method should never accept more than one parameter.', 'A database connection must be restricted to a single thread at a time.', 'B'),
  ('blacktie-protocol', 6, 'Coding & Algorithms', 'What is the average time complexity of the QuickSort algorithm, and under what condition does it degrade to its worst-case O(N^2)?', 'Average O(N log N); worst-case occurs when the pivot chosen is consistently the smallest or largest element (e.g., already sorted array with poor pivot selection).', 'Average O(N); worst-case occurs when array length is an even number.', 'Average O(N^2); worst-case occurs when memory capacity is exceeded.', 'Average O(log N); worst-case occurs when elements are duplicate strings.', 'A'),
  ('blacktie-protocol', 7, 'Coding & Algorithms', 'In modern REST API design, why is the PUT HTTP method considered Idempotent, while POST is generally non-idempotent?', 'Sending a PUT request multiple times results in the same state on the server as sending it once; repeating a POST request usually creates multiple duplicate resources.', 'PUT encrypts payload data using SSL, whereas POST sends unencrypted plain text.', 'PUT can only be called from backend microservices; POST can be executed by browser clients.', 'PUT bypasses API gateway rate-limiting, while POST enforces strict throttle limits.', 'A'),
  ('blacktie-protocol', 8, 'IT Infrastructure & Systems Architecture', 'How does a Reverse Proxy (e.g., NGINX) differ fundamentally from a standard Forward Proxy?', 'A Forward Proxy sits in front of backend servers to shield them; a Reverse Proxy sits in front of client devices to hide their IP addresses.', 'A Forward Proxy acts on behalf of clients (users) accessing external networks; a Reverse Proxy acts on behalf of backend application servers accepting incoming traffic.', 'A Reverse Proxy handles only hardware storage drives, while a Forward Proxy handles virtual switches.', 'A Forward Proxy decrypts HTTPS traffic, whereas a Reverse Proxy converts IPv4 to IPv6.', 'B'),
  ('blacktie-protocol', 9, 'IT Infrastructure & Systems Architecture', 'In distributed database design, what is the primary purpose of Database Sharding?', 'To create a real-time hot standby replica of a database in a different geographic region.', 'To horizontally partition large datasets across multiple independent database servers to scale write performance and storage capacity.', 'To compress static image assets into blob files before writing to disk.', 'To encrypt sensitive user columns using AES-256 keys.', 'B'),
  ('blacktie-protocol', 10, 'IT Infrastructure & Systems Architecture', 'In containerized environments, how does Docker container isolation differ from full Virtual Machine (VM) virtualization?', 'Containers package their own dedicated guest operating system kernels; VMs share the host kernel.', 'Containers share the host operating system kernel and isolate processes using namespaces and cgroups; VMs virtualize full underlying hardware and run separate guest OS kernels.', 'VMs boot up in milliseconds; containers take minutes to start up.', 'Containers cannot run networking protocols, whereas VMs natively support TCP/IP.', 'B'),
  ('blacktie-protocol', 11, 'IT Infrastructure & Systems Architecture', 'In Cloud Security, what is the core premise of the Shared Responsibility Model for Infrastructure as a Service (IaaS)?', 'The cloud provider manages operating system patches and application code; the customer manages physical server security.', 'The cloud provider secures the underlying physical infrastructure, hypervisor, and hardware; the customer secures the OS, network configuration, access permissions, and application data.', 'The cloud provider takes 100% legal responsibility for all user data breaches.', 'The customer manages datacenter power and cooling; the provider manages password resets.', 'B'),
  ('blacktie-protocol', 12, 'IT Infrastructure & Systems Architecture', 'What is the function of a Dead Letter Queue (DLQ) in enterprise asynchronous messaging systems (e.g., RabbitMQ, Kafka, AWS SQS)?', 'To archive messages that have been successfully processed for long-term auditing.', 'To capture and isolate messages that cannot be processed successfully due to system errors or malformed payloads after a specified retry threshold.', 'To store high-priority administrative alerts during a network outage.', 'To encrypt message payloads before transmission over public internet backbones.', 'B'),
  ('blacktie-protocol', 13, 'IT Infrastructure & Systems Architecture', 'In network security, what is the primary advantage of implementing a Dual-Factor / Multi-Factor Authentication (MFA) system using Time-based One-Time Passwords (TOTP) over SMS-based OTPs?', 'TOTP codes do not expire after creation.', 'TOTP uses offline cryptographic key derivation on the user device, making it immune to SIM-swapping and SMS interception attacks.', 'SMS-based OTPs require specialized hardware tokens that end users must purchase.', 'TOTP eliminates the need for user passwords entirely.', 'B'),
  ('blacktie-protocol', 14, 'IT Infrastructure & Systems Architecture', 'What problem does a Circuit Breaker Pattern solve in a microservices network architecture?', 'It prevents a failing downstream service from causing cascading failures across dependent upstream services by failing fast when errors hit a threshold.', 'It automatically increases CPU and RAM allocations to lagging microservices.', 'It translates GraphQL queries into RESTful HTTP calls on the fly.', 'It converts public IP traffic to local loopback addresses during maintenance windows.', 'A'),
  ('blacktie-protocol', 15, 'IT Management, Governance & Incident Response', 'In ITIL Service Management, what is the critical difference between an Incident and a Problem?', 'An Incident is a planned system maintenance window; a Problem is an unplanned network outage.', 'An Incident is an unplanned interruption or reduction in quality of an IT service; a Problem is the underlying, unknown root cause of one or more incidents.', 'Incidents are handled by executive directors; Problems are handled by tier-1 helpdesk technicians.', 'Incidents apply only to hardware; Problems apply exclusively to software code bugs.', 'B'),
  ('blacktie-protocol', 16, 'IT Management, Governance & Incident Response', 'During a major software deployment, what is a Canary Deployment strategy?', 'Rolling out a new software release to 100% of the production infrastructure at a pre-scheduled midnight downtime window.', 'Deploying the new version of an application to a tiny subset of real users/servers first to validate stability before gradually rolling it out to the full fleet.', 'Duplicating the entire production infrastructure in a secondary cloud region before making code changes.', 'Testing software exclusively on developer laptops before committing code to version control.', 'B'),
  ('blacktie-protocol', 17, 'IT Management, Governance & Incident Response', 'What is the difference between a Cold Site, Warm Site, and Hot Site in IT Disaster Recovery planning?', 'Cold sites are housed in air-conditioned facilities; Hot sites run in tropical regions.', 'A Cold Site provides basic space/power without equipment; a Warm Site has hardware pre-installed but needs data restoration; a Hot Site is a fully configured, real-time mirrored environment ready for near-instant failover.', 'Hot sites are cheaper to maintain than Cold sites.', 'Warm sites are operated exclusively by open-source non-profit organizations.', 'B'),
  ('blacktie-protocol', 18, 'IT Management, Governance & Incident Response', 'In Agile software development governance, what is the Definition of Done (DoD)?', 'A sign-off document written by the legal department before starting a project sprint.', 'An agreed-upon set of explicit quality criteria (e.g., code reviewed, unit tests passed, documentation updated, deployed to staging) that a user story must satisfy before being considered complete.', 'The official target date when an entire application software product is retired.', 'A contract specifying developer overtime pay rates for sprint completions.', 'B'),
  ('blacktie-protocol', 19, 'IT Management, Governance & Incident Response', 'In IT Financial Management, what is the key distinction between CapEx (Capital Expenditure) and OpEx (Operational Expenditure)?', 'CapEx involves major upfront investments in long-term assets (e.g., physical servers, datacenters); OpEx refers to ongoing operational day-to-day business costs (e.g., monthly cloud subscriptions, utility bills).', 'CapEx is used exclusively for software developer salaries; OpEx is used for hardware purchases.', 'CapEx expenses are non-tax-deductible; OpEx expenses are illegal in enterprise accounting.', 'CapEx reflects cloud pay-as-you-go billing; OpEx reflects physical hardware purchasing.', 'A'),
  ('blacktie-protocol', 20, 'IT Management, Governance & Incident Response', 'What is the role of a Service Level Objective (SLO) relative to a Service Level Agreement (SLA)?', 'An SLA is an internal target set by developers; an SLO is a government regulatory mandate.', 'An SLO is a specific target metric (e.g., 99.9% uptime) that defines service performance internally; an SLA is the formal legal agreement with customers that includes financial penalties if the SLO thresholds are breached.', 'SLOs apply only to database response times; SLAs apply only to email response times.', 'An SLO is updated annually; an SLA cannot be changed once signed.', 'B'),
  ('blacktie-protocol', 21, 'IT Management, Governance & Incident Response', 'When an IT organization implements an A/B Testing release framework, what is being measured?', 'The baseline CPU performance differences between Intel and AMD server processors.', 'Comparing user behavior and performance metrics between two variations (Version A vs. Version B) of a product feature running concurrently in production.', 'The time delay between writing a code commit and compiling the binary output.', 'Comparing the security vulnerability scan outputs of two competing antivirus scanners.', 'B'),
  ('blacktie-protocol', 22, 'Current Affairs — Tech, Business & Policy', 'Hosted by MeitY at Bharat Mandapam in New Delhi, which landmark global summit was convened to focus on democratizing AI compute resources and fostering inclusive AI infrastructure across the Global South?', 'Global Partnership on AI (GPAI) Paris Charter', 'India AI Impact Summit', 'World Economic Forum Tech Accord', 'Global AI Governance Assembly Tokyo', 'B'),
  ('blacktie-protocol', 23, 'Current Affairs — Tech, Business & Policy', 'Following NIST''s standardization of Post-Quantum Cryptography (PQC) standards, which lattice-based key encapsulation algorithm (formerly CRYSTALS-Kyber) was selected as the primary standard for general public-key encryption?', 'RSA-4096', 'ML-KEM', 'SHA-3', 'ECDSA P-384', 'B'),
  ('blacktie-protocol', 24, 'Current Affairs — Tech, Business & Policy', 'Under the phased implementation of the European Union''s comprehensive EU AI Act, which compliance milestone and enforcement wave came into effect targeting High-Risk AI Systems (Annex III obligations)?', 'August 2, 2026 enforcement deadline', 'January 1, 2024 initial charter', 'October 2028 backstop', 'December 2030 grace period', 'A'),
  ('blacktie-protocol', 25, 'Current Affairs — Tech, Business & Policy', 'What major architecture shift did TSMC deploy in its 2-nanometer (N2) mass production node to overcome gate leakage and maintain transistor scaling limits?', 'Transitioning from FinFET to Gate-All-Around (GAA) Nanosheet transistors', 'Abandonment of EUV lithography in favor of legacy optical lasers', 'Shifting exclusively to Germanium-only substrate wafers', 'Replacing copper interconnects with carbon nanotubes', 'A'),
  ('blacktie-protocol', 26, 'Current Affairs — Tech, Business & Policy', 'In enterprise software architectures, which framework paradigm emerged as the dominant pattern for coordinating multi-agent autonomous workflows (e.g., using Microsoft AutoGen or LangGraph)?', 'Batch MapReduce processing', 'Autonomous Agentic Orchestration', 'Monolithic SOAP API endpoints', 'Single-threaded event polling', 'B'),
  ('blacktie-protocol', 27, 'Current Affairs — Tech, Business & Policy', 'Under India''s Digital Personal Data Protection (DPDP) Act, what mandatory obligation is imposed on significant Data Fiduciaries regarding enterprise data processing?', 'Mandatory installation of government-issued firewall hardware', 'Appointment of a Data Protection Officer (DPO) and conducting Data Protection Impact Assessments (DPIAs)', 'Releasing all internal business codebases as open-source software', 'Restricting cloud hosting exclusively to state-owned datacenters', 'B'),
  ('blacktie-protocol', 28, 'Current Affairs — Tech, Business & Policy', 'What key standard from 3GPP enables modern smartphones to communicate directly with Low Earth Orbit (LEO) satellites without requiring proprietary satellite dishes or external dongles?', '3GPP Non-Terrestrial Networks (NTN) Direct-to-Cell specifications', 'Wi-Fi 7 Mesh Long-Range Repeaters', 'Submarine Fiber Optic Bridging', 'Legacy C-Band Microwave Links', 'A'),
  ('blacktie-protocol', 29, 'General Knowledge & Tech Trivia', 'Who is widely recognized in computer science history for authoring the first algorithm intended to be processed by Charles Babbage''s mechanical Analytical Engine?', 'Alan Turing', 'Grace Hopper', 'Ada Lovelace', 'John von Neumann', 'C'),
  ('blacktie-protocol', 30, 'General Knowledge & Tech Trivia', 'What real-world incident in 1947 inspired Rear Admiral Grace Hopper and her team to popularize the term "debugging" in computing history?', 'A short circuit caused by spilled coffee in ENIAC', 'Removing an actual moth trapped inside Relay #70 of the Harvard Mark II computer', 'A buffer overflow on an early magnetic drum unit', 'A corrupted physical paper tape reader', 'B'),
  ('blacktie-protocol', 31, 'General Knowledge & Tech Trivia', 'Which pioneering computer network, funded by the U.S. Department of Defense in the late 1960s, laid the foundational packet-switching technologies that evolved into TCP/IP and the modern Internet?', 'ALOHANET', 'ARPANET', 'BITNET', 'Ethernet', 'B'),
  ('blacktie-protocol', 32, 'General Knowledge & Tech Trivia', 'Which open-source operating system kernel was initially created and released by Linus Torvalds in 1991 as a free alternative to MINIX?', 'FreeBSD', 'Linux', 'OpenBSD', 'Solaris', 'B'),
  ('blacktie-protocol', 33, 'General Knowledge & Tech Trivia', 'During World War II, what was the code name of the British codebreaking site where Alan Turing built the electromechanical "Bombe" to decipher German Enigma messages?', 'Bletchley Park', 'Los Alamos', 'Oak Ridge', 'Arlington Hall', 'A'),
  ('blacktie-protocol', 34, 'General Knowledge & Tech Trivia', 'What original name did James Gosling give to the Java programming language when he began developing it at Sun Microsystems in 1991?', 'Oak', 'Duke', 'Green', 'Coffee', 'A'),
  ('blacktie-protocol', 35, 'Aptitude, Data Interpretation & Logic', 'A cloud operations team consists of 5 SysOps engineers and 4 Security analysts. A emergency task force of 4 people needs to be formed. What is the probability that the team contains exactly 2 SysOps engineers and 2 Security analysts?', '10/21', '5/14', '2/5', '15/28', 'A'),
  ('blacktie-protocol', 36, 'Aptitude, Data Interpretation & Logic', 'A microservice receives incoming API requests at a constant rate of 200 requests/second. A API gateway divides traffic between Node A and Node B in a 3:2 ratio. How many total requests does Node B process in 5 minutes?', '24,000', '36,000', '16,000', '48,000', 'A'),
  ('blacktie-protocol', 37, 'Aptitude, Data Interpretation & Logic', 'Five microservices (A, B, C, D, E) must be deployed sequentially in a CI/CD pipeline under these conditions:
1. Service A must be deployed before Service B.
2. Service C must be deployed immediately after Service D.
3. Service E cannot be deployed first (position 1) or last (position 5).
Which sequence satisfies all rules?', 'E, D, C, A, B', 'D, C, A, E, B', 'A, B, D, C, E', 'D, A, C, B, E', 'B'),
  ('blacktie-protocol', 38, 'Aptitude, Data Interpretation & Logic', 'If 6 DevOps engineers can configure 12 Kubernetes clusters in 8 hours, how many hours will it take 4 DevOps engineers to configure 18 Kubernetes clusters operating at the exact same efficiency?', '12 hours', '18 hours', '16 hours', '24 hours', 'B'),
  ('blacktie-protocol', 39, 'Aptitude, Data Interpretation & Logic', 'An unbuffered network cable transmits 1,000 data packets. Due to signal interference, the probability of packet corruption on any single transmission is 0.02. What is the expected number of successfully delivered packets?', '980', '998', '950', '920', 'A'),
  ('blacktie-protocol', 40, 'Aptitude, Data Interpretation & Logic', 'Identify the missing number in this sequence: 2, 6, 12, 20, 30, 42, ?', '52', '56', '60', '64', 'B')
on conflict (event_slug, question_number) do nothing;
