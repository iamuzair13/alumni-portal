# Performance Baseline

Generated: 2026-11-05T11:20:56.647Z — EXPLAIN (ANALYZE, BUFFERS)
Dataset: see table counts below. Synthetic rows tagged datasource='PERF_SEED'.

## Table counts

```json
{
  "alumni": "137703",
  "cards": "3774",
  "scholarships": "43",
  "memberships": "32"
}
```

## alumni-list-default — GET /api/alumni (no filters)

- execution: **1.662 ms** · planning: 6.376 ms · wall: 12 ms
- scan nodes: Seq Scan:tblchapters

```
Limit  (cost=1.28..139.31 rows=100 width=501) (actual time=0.172..1.462 rows=100.00 loops=1)
  Buffers: shared hit=598
  ->  Nested Loop Left Join  (cost=1.28..121054.84 rows=87703 width=501) (actual time=0.171..1.448 rows=100.00 loops=1)
        Join Filter: ((c1.id)::numeric = ac.chapter1)
        Rows Removed by Join Filter: 3000
        Buffers: shared hit=598
        ->  Nested Loop Left Join  (cost=1.28..76543.20 rows=87703 width=474) (actual time=0.119..0.788 rows=100.00 loops=1)
              Buffers: shared hit=596
              ->  Nested Loop Left Join  (cost=1.00..49537.07 rows=87703 width=469) (actual time=0.105..0.645 rows=100.00 loops=1)
                    Buffers: shared hit=396
                    ->  Nested Loop Left Join  (cost=0.71..47168.35 rows=87703 width=435) (actual time=0.067..0.354 rows=100.00 loops=1)
                          Buffers: shared hit=138
                          ->  Nested Loop Left Join  (cost=0.56..44986.02 rows=87703 width=412) (actual time=0.051..0.199 rows=100.00 loops=1)
                                Buffers: shared hit=34
                                ->  Index Scan Backward using tbl_alumni_pkey on tbl_alumni a  (cost=0.42..42882.86 rows=87703 width=391) (actual time=0.032..0.101 rows=100.00 loops=1)
                                      Index Searches: 1
                                      Buffers: shared hit=10
                                ->  Memoize  (cost=0.15..0.16 rows=1 width=37) (actual time=0.001..0.001 rows=1.00 loops=100)
                                      Cache Key: a.faculty
                                      Cache Mode: logical
                                      Hits: 88  Misses: 12  Evictions: 0  Overflows: 0  Memory Usage: 2kB
                                      Buffers: shared hit=24
                                      ->  Index Scan using uol_faculties_pkey on tbl_faculties f  (cost=0.14..0.15 rows=1 width=37) (actual time=0.002..0.002 rows=1.00 loops=12)
                                            Index Cond: (id = a.faculty)
                                            Index Searches: 12
                                            Buffers: shared hit=24
                          ->  Memoize  (cost=0.15..0.17 rows=1 width=39) (actual time=0.001..0.001 rows=1.00 loops=100)
                                Cache Key: a.department
                                Cache Mode: logical
                                Hits: 48  Misses: 52  Evictions: 0  Overflows: 0  Memory Usage: 8kB
                                Buffers: shared hit=104
                                ->  Index Scan using uol_departments_pkey on tbl_departments d  (cost=0.14..0.16 rows=1 width=39) (actual time=0.001..0.001 rows=1.00 loops=52)
                                      Index Cond: (id = a.department)
                                      Index Searches: 52
                                      Buffers: shared hit=104
                    ->  Memoize  (cost=0.29..0.30 rows=1 width=50) (actual time=0.002..0.002 rows=1.00 loops=100)
                          Cache Key: a.program
                          Cache Mode: logical
                          Hits: 14  Misses: 86  Evictions: 0  Overflows: 0  Memory Usage: 14kB
                          Buffers: shared hit=258
                          ->  Index Scan using tbl_programs_pkey on tbl_programs p  (cost=0.28..0.29 rows=1 width=50) (actual time=0.002..0.002 rows=1.00 loops=86)
                                Index Cond: (id = a.program)
                                Index Searches: 86
                                Buffers: shared hit=258
              ->  Index Scan using alumni_chapter_pkey on alumni_chapter ac  (cost=0.29..0.31 rows=1 width=9) (actual time=0.001..0.001 rows=0.00 loops=100)
                    Index Cond: (id = a.alumniid)
                    Index Searches: 100
                    Buffers: shared hit=200
        ->  Materialize  (cost=0.00..2.44 rows=29 width=42) (actual time=0.000..0.002 rows=30.00 loops=100)
              Storage: Memory  Maximum Storage: 18kB
              Buffers: shared hit=2
              ->  Seq Scan on tblchapters c1  (cost=0.00..2.29 rows=29 width=42) (actual time=0.014..0.019 rows=30.00 loops=1)
                    Buffers: shared hit=2
Planning:
  Buffers: shared hit=733
Planning Time: 6.376 ms
Execution Time: 1.662 ms
```

## alumni-search-3filters — GET /api/alumni?search=zafar&gender=Male&homeCountry=Pakistan&campusname=Lahore

- execution: **1477.742 ms** · planning: 1.63 ms · wall: 1483 ms
- scan nodes: Seq Scan:tbl_alumni, Seq Scan:tbl_departments, Seq Scan:tbl_programs, Seq Scan:tbl_faculties, Seq Scan:tblchapters

```
Limit  (cost=24771.44..24771.44 rows=1 width=501) (actual time=1477.565..1477.653 rows=100.00 loops=1)
  Buffers: shared hit=234068
  ->  Sort  (cost=24771.44..24771.44 rows=1 width=501) (actual time=1477.564..1477.643 rows=100.00 loops=1)
        Sort Key: a.alumniid DESC
        Sort Method: top-N heapsort  Memory: 123kB
        Buffers: shared hit=234068
        ->  Nested Loop Left Join  (cost=1000.28..24771.43 rows=1 width=501) (actual time=2.656..1476.599 rows=673.00 loops=1)
              Join Filter: ((c1.id)::numeric = ac.chapter1)
              Rows Removed by Join Filter: 20147
              Buffers: shared hit=234065
              ->  Nested Loop Left Join  (cost=1000.28..24768.70 rows=1 width=474) (actual time=2.644..1470.560 rows=673.00 loops=1)
                    Buffers: shared hit=232719
                    ->  Nested Loop Left Join  (cost=1000.00..24760.40 rows=1 width=469) (actual time=2.618..1468.576 rows=673.00 loops=1)
                          Join Filter: (f.id = a.faculty)
                          Rows Removed by Join Filter: 115315
                          Filter: ((lower((a.alumniid)::text) ~~ '%zafar%'::text) OR (lower((COALESCE(a.sapid, ''::character varying))::text) ~~ '%zafar%'::text) OR (lower((COALESCE(a.registrationno, ''::character varying))::text) ~~ '%zafar%'::text) OR (lower((COALESCE(a.alumniname, ''::character varying))::text) ~~ '%zafar%'::text) OR (lower((COALESCE(a.personalemail, ''::character varying))::text) ~~ '%zafar%'::text) OR (lower((COALESCE(a.officialemail, ''::character varying))::text) ~~ '%zafar%'::text) OR (lower(COALESCE(f.faculty_name, ''::text)) ~~ '%zafar%'::text) OR (lower(COALESCE(d.department_name, ''::text)) ~~ '%zafar%'::text) OR (lower(COALESCE(p.program_name, ''::text)) ~~ '%zafar%'::text))
                          Rows Removed by Filter: 24334
                          Buffers: shared hit=231330
                          ->  Nested Loop Left Join  (cost=1000.00..24758.53 rows=1 width=448) (actual time=0.813..1302.730 rows=25007.00 loops=1)
                                Join Filter: (p.id = a.program)
                                Rows Removed by Join Filter: 7403881
                                Buffers: shared hit=206323
                                ->  Nested Loop Left Join  (cost=1000.00..24735.09 rows=1 width=414) (actual time=0.712..172.099 rows=25007.00 loops=1)
                                      Join Filter: (d.id = a.department)
                                      Rows Removed by Join Filter: 706175
                                      Buffers: shared hit=47552
                                      ->  Gather  (cost=1000.00..24732.74 rows=1 width=391) (actual time=0.702..9.020 rows=25007.00 loops=1)
                                            Workers Planned: 2
                                            Workers Launched: 2
                                            Buffers: shared hit=22545
                                            ->  Parallel Seq Scan on tbl_alumni a  (cost=0.00..23732.64 rows=1 width=391) (actual time=0.152..61.624 rows=8335.67 loops=3)
                                                  Filter: ((lower(TRIM(BOTH FROM COALESCE(gender, ''::character varying))) = 'male'::text) AND (lower(TRIM(BOTH FROM COALESCE(country, ''::character varying))) = 'pakistan'::text) AND (lower(TRIM(BOTH FROM COALESCE(campusname, ''::character varying))) = 'lahore'::text))
                                                  Rows Removed by Filter: 37565
                                                  Buffers: shared hit=22545
                                      ->  Seq Scan on tbl_departments d  (cost=0.00..1.60 rows=60 width=39) (actual time=0.001..0.003 rows=29.24 loops=25007)
                                            Buffers: shared hit=25007
                                ->  Seq Scan on tbl_programs p  (cost=0.00..15.97 rows=597 width=50) (actual time=0.001..0.022 rows=297.07 loops=25007)
                                      Buffers: shared hit=158771
                          ->  Seq Scan on tbl_faculties f  (cost=0.00..1.12 rows=12 width=37) (actual time=0.001..0.001 rows=5.61 loops=25007)
                                Buffers: shared hit=25007
                    ->  Index Scan using alumni_chapter_pkey on alumni_chapter ac  (cost=0.29..8.30 rows=1 width=9) (actual time=0.002..0.002 rows=0.06 loops=673)
                          Index Cond: (id = a.alumniid)
                          Index Searches: 673
                          Buffers: shared hit=1389
              ->  Seq Scan on tblchapters c1  (cost=0.00..2.29 rows=29 width=42) (actual time=0.001..0.003 rows=30.00 loops=673)
                    Buffers: shared hit=1346
Planning:
  Buffers: shared hit=51
Planning Time: 1.630 ms
Execution Time: 1477.742 ms
```

## alumni-counts — GET /api/alumni/counts (no filters)

- execution: **681.111 ms** · planning: 0.32 ms · wall: 684 ms
- scan nodes: Seq Scan:tbl_alumni

```
Aggregate  (cost=45532.10..45532.11 rows=1 width=112) (actual time=680.378..680.380 rows=1.00 loops=1)
  Buffers: shared hit=22545
  ->  Sort  (cost=30622.59..30841.85 rows=87703 width=53) (actual time=128.212..140.289 rows=137703.00 loops=1)
        Sort Key: a.alumniid
        Sort Method: quicksort  Memory: 11477kB
        Buffers: shared hit=22545
        ->  Seq Scan on tbl_alumni a  (cost=0.00..23422.03 rows=87703 width=53) (actual time=0.009..87.283 rows=137703.00 loops=1)
              Buffers: shared hit=22545
Planning:
  Buffers: shared hit=6
Planning Time: 0.320 ms
Execution Time: 681.111 ms
```

## filter-options-employers — GET /api/alumni/employers (one of ~25 identical endpoints)

- execution: **185.499 ms** · planning: 0.144 ms · wall: 188 ms
- scan nodes: Seq Scan:tbl_alumni

```
GroupAggregate  (cost=24102.36..24112.90 rows=414 width=40) (actual time=168.042..185.156 rows=6935.00 loops=1)
  Group Key: (CASE WHEN ((nameoforganization IS NULL) OR (TRIM(BOTH FROM COALESCE(nameoforganization, ''::character varying)) = ''::text)) THEN 'Null'::text ELSE TRIM(BOTH FROM nameoforganization) END)
  Buffers: shared hit=22548
  ->  Sort  (cost=24102.36..24103.46 rows=439 width=32) (actual time=168.029..173.379 rows=96846.00 loops=1)
        Sort Key: (CASE WHEN ((nameoforganization IS NULL) OR (TRIM(BOTH FROM COALESCE(nameoforganization, ''::character varying)) = ''::text)) THEN 'Null'::text ELSE TRIM(BOTH FROM nameoforganization) END)
        Sort Method: quicksort  Memory: 3073kB
        Buffers: shared hit=22548
        ->  Seq Scan on tbl_alumni a  (cost=0.00..24083.10 rows=439 width=32) (actual time=0.016..125.559 rows=96846.00 loops=1)
              Filter: (lower(TRIM(BOTH FROM COALESCE(gender, ''::character varying))) = 'male'::text)
              Rows Removed by Filter: 40857
              Buffers: shared hit=22545
Planning:
  Buffers: shared hit=5
Planning Time: 0.144 ms
Execution Time: 185.499 ms
```

## alumni-cards-applicants — GET /api/alumni-cards/applicants

- execution: **2.825 ms** · planning: 1.171 ms · wall: 7 ms
- scan nodes: Seq Scan:tblcard, Seq Scan:tbl_faculties

```
Sort  (cost=548.36..548.46 rows=38 width=193) (actual time=2.764..2.767 rows=0.00 loops=1)
  Sort Key: c.createdat DESC
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=126
  ->  Hash Left Join  (cost=2.10..547.37 rows=38 width=193) (actual time=2.742..2.745 rows=0.00 loops=1)
        Hash Cond: (a.faculty = f.id)
        Buffers: shared hit=123
        ->  Nested Loop Left Join  (cost=0.83..545.96 rows=38 width=172) (actual time=2.741..2.743 rows=0.00 loops=1)
              Buffers: shared hit=123
              ->  Nested Loop Left Join  (cost=0.56..534.82 rows=38 width=138) (actual time=2.740..2.742 rows=0.00 loops=1)
                    Buffers: shared hit=123
                    ->  Nested Loop  (cost=0.42..528.85 rows=38 width=115) (actual time=2.740..2.741 rows=0.00 loops=1)
                          Buffers: shared hit=123
                          ->  Seq Scan on tblcard c  (cost=0.00..208.32 rows=38 width=21) (actual time=2.739..2.739 rows=0.00 loops=1)
                                Filter: ((status IS NULL) OR (TRIM(BOTH FROM status) = ''::text) OR (upper(TRIM(BOTH FROM status)) = 'PENDING'::text))
                                Rows Removed by Filter: 3774
                                Buffers: shared hit=123
                          ->  Index Scan using tbl_alumni_pkey on tbl_alumni a  (cost=0.42..8.44 rows=1 width=98) (never executed)
                                Index Cond: (alumniid = c.alumniid)
                                Index Searches: 0
                    ->  Index Scan using uol_departments_pkey on tbl_departments d  (cost=0.14..0.16 rows=1 width=39) (never executed)
                          Index Cond: (id = a.department)
                          Index Searches: 0
              ->  Index Scan using tbl_programs_pkey on tbl_programs p  (cost=0.28..0.29 rows=1 width=50) (never executed)
                    Index Cond: (id = a.program)
                    Index Searches: 0
        ->  Hash  (cost=1.12..1.12 rows=12 width=37) (never executed)
              ->  Seq Scan on tbl_faculties f  (cost=0.00..1.12 rows=12 width=37) (never executed)
Planning:
  Buffers: shared hit=56
Planning Time: 1.171 ms
Execution Time: 2.825 ms
```

## dash-kpi-alumni — /api/analytics/realtime-dashboard (kpiRows)

- execution: **58.603 ms** · planning: 0.085 ms · wall: 61 ms
- scan nodes: Seq Scan:tbl_alumni

```
Finalize Aggregate  (cost=24641.51..24641.53 rows=1 width=12) (actual time=53.663..58.569 rows=1.00 loops=1)
  Buffers: shared hit=22545
  ->  Gather  (cost=24641.29..24641.50 rows=2 width=24) (actual time=53.553..58.562 rows=3.00 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=22545
        ->  Partial Aggregate  (cost=23641.29..23641.30 rows=1 width=24) (actual time=44.962..44.963 rows=1.00 loops=3)
              Buffers: shared hit=22545
              ->  Parallel Seq Scan on tbl_alumni a  (cost=0.00..22910.43 rows=36543 width=34) (actual time=0.015..26.893 rows=45901.00 loops=3)
                    Buffers: shared hit=22545
Planning Time: 0.085 ms
Execution Time: 58.603 ms
```

## dash-faculty-registrations — realtime-dashboard facultyRegistrations

- execution: **88.11 ms** · planning: 0.248 ms · wall: 91 ms
- scan nodes: Seq Scan:tbl_alumni, Seq Scan:tbl_faculties

```
Sort  (cost=25050.50..25050.53 rows=12 width=44) (actual time=82.977..88.045 rows=13.00 loops=1)
  Sort Key: ((count(*))::integer) DESC
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=22564
  ->  Finalize GroupAggregate  (cost=25046.35..25050.29 rows=12 width=44) (actual time=82.947..88.035 rows=13.00 loops=1)
        Group Key: (COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text))
        Buffers: shared hit=22564
        ->  Gather Merge  (cost=25046.35..25049.73 rows=29 width=56) (actual time=82.937..88.017 rows=39.00 loops=1)
              Workers Planned: 2
              Workers Launched: 2
              Buffers: shared hit=22564
              ->  Sort  (cost=24046.33..24046.36 rows=12 width=56) (actual time=74.439..74.442 rows=13.00 loops=3)
                    Sort Key: (COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text))
                    Sort Method: quicksort  Memory: 25kB
                    Buffers: shared hit=22564
                    Worker 0:  Sort Method: quicksort  Memory: 25kB
                    Worker 1:  Sort Method: quicksort  Memory: 25kB
                    ->  Partial HashAggregate  (cost=24045.93..24046.11 rows=12 width=56) (actual time=74.387..74.392 rows=13.00 loops=3)
                          Group Key: COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text)
                          Batches: 1  Memory Usage: 32kB
                          Buffers: shared hit=22548
                          Worker 0:  Batches: 1  Memory Usage: 32kB
                          Worker 1:  Batches: 1  Memory Usage: 32kB
                          ->  Hash Left Join  (cost=1.27..23223.71 rows=36543 width=66) (actual time=0.091..48.787 rows=45901.00 loops=3)
                                Hash Cond: (a.faculty = f.id)
                                Buffers: shared hit=22548
                                ->  Parallel Seq Scan on tbl_alumni a  (cost=0.00..22910.43 rows=36543 width=42) (actual time=0.016..30.196 rows=45901.00 loops=3)
                                      Buffers: shared hit=22545
                                ->  Hash  (cost=1.12..1.12 rows=12 width=37) (actual time=0.062..0.063 rows=12.00 loops=3)
                                      Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                      Buffers: shared hit=3
                                      ->  Seq Scan on tbl_faculties f  (cost=0.00..1.12 rows=12 width=37) (actual time=0.051..0.053 rows=12.00 loops=3)
                                            Buffers: shared hit=3
Planning:
  Buffers: shared hit=4
Planning Time: 0.248 ms
Execution Time: 88.110 ms
```

## dash-faculty-categories — realtime-dashboard facultyCategoryRows

- execution: **580.557 ms** · planning: 0.254 ms · wall: 584 ms
- scan nodes: Seq Scan:tbl_alumni, Seq Scan:tbl_faculties

```
GroupAggregate  (cost=31372.70..36415.86 rows=12 width=40) (actual time=438.400..579.412 rows=13.00 loops=1)
  Group Key: (COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text))
  Buffers: shared hit=22546
  ->  Sort  (cost=31372.70..31591.96 rows=87703 width=42) (actual time=394.300..411.189 rows=137703.00 loops=1)
        Sort Key: (COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text)), a.alumniid
        Sort Method: quicksort  Memory: 12771kB
        Buffers: shared hit=22546
        ->  Hash Left Join  (cost=1.27..24172.14 rows=87703 width=42) (actual time=0.033..131.716 rows=137703.00 loops=1)
              Hash Cond: (a.faculty = f.id)
              Buffers: shared hit=22546
              ->  Seq Scan on tbl_alumni a  (cost=0.00..23422.03 rows=87703 width=18) (actual time=0.010..78.300 rows=137703.00 loops=1)
                    Buffers: shared hit=22545
              ->  Hash  (cost=1.12..1.12 rows=12 width=37) (actual time=0.011..0.012 rows=12.00 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 9kB
                    Buffers: shared hit=1
                    ->  Seq Scan on tbl_faculties f  (cost=0.00..1.12 rows=12 width=37) (actual time=0.004..0.006 rows=12.00 loops=1)
                          Buffers: shared hit=1
Planning:
  Buffers: shared hit=4
Planning Time: 0.254 ms
Execution Time: 580.557 ms
```

## dash-faculty-occupations — realtime-dashboard facultyOccupationRows

- execution: **203.076 ms** · planning: 0.308 ms · wall: 206 ms
- scan nodes: Seq Scan:tbl_alumni, Seq Scan:tbl_faculties

```
Sort  (cost=27243.29..27243.32 rows=12 width=52) (actual time=197.560..202.992 rows=13.00 loops=1)
  Sort Key: ((count(*) FILTER (WHERE ((lower((COALESCE(a.verify, ''::character varying))::text) = 'true'::text) AND (TRIM(BOTH FROM COALESCE(a.employeed, ''::text)) <> ''::text))))::integer) DESC
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=22564
  ->  Finalize GroupAggregate  (cost=27238.93..27243.07 rows=12 width=52) (actual time=197.530..202.983 rows=13.00 loops=1)
        Group Key: (COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text))
        Buffers: shared hit=22564
        ->  Gather Merge  (cost=27238.93..27242.31 rows=29 width=72) (actual time=197.517..202.959 rows=39.00 loops=1)
              Workers Planned: 2
              Workers Launched: 2
              Buffers: shared hit=22564
              ->  Sort  (cost=26238.91..26238.94 rows=12 width=72) (actual time=188.623..188.627 rows=13.00 loops=3)
                    Sort Key: (COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text))
                    Sort Method: quicksort  Memory: 26kB
                    Buffers: shared hit=22564
                    Worker 0:  Sort Method: quicksort  Memory: 26kB
                    Worker 1:  Sort Method: quicksort  Memory: 26kB
                    ->  Partial HashAggregate  (cost=26238.51..26238.69 rows=12 width=72) (actual time=188.568..188.573 rows=13.00 loops=3)
                          Group Key: COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text)
                          Batches: 1  Memory Usage: 32kB
                          Buffers: shared hit=22548
                          Worker 0:  Batches: 1  Memory Usage: 32kB
                          Worker 1:  Batches: 1  Memory Usage: 32kB
                          ->  Hash Left Join  (cost=1.27..23223.71 rows=36543 width=48) (actual time=0.097..52.371 rows=45901.00 loops=3)
                                Hash Cond: (a.faculty = f.id)
                                Buffers: shared hit=22548
                                ->  Parallel Seq Scan on tbl_alumni a  (cost=0.00..22910.43 rows=36543 width=24) (actual time=0.017..32.271 rows=45901.00 loops=3)
                                      Buffers: shared hit=22545
                                ->  Hash  (cost=1.12..1.12 rows=12 width=37) (actual time=0.065..0.066 rows=12.00 loops=3)
                                      Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                      Buffers: shared hit=3
                                      ->  Seq Scan on tbl_faculties f  (cost=0.00..1.12 rows=12 width=37) (actual time=0.051..0.053 rows=12.00 loops=3)
                                            Buffers: shared hit=3
Planning:
  Buffers: shared hit=4
Planning Time: 0.308 ms
Execution Time: 203.076 ms
```

## dash-faculty-transitions — realtime-dashboard facultyTransitionRows

- execution: **185.906 ms** · planning: 0.346 ms · wall: 189 ms
- scan nodes: Seq Scan:tbl_alumni, Seq Scan:tbl_faculties

```
Sort  (cost=27791.64..27791.67 rows=12 width=60) (actual time=180.510..185.828 rows=13.00 loops=1)
  Sort Key: ((count(*) FILTER (WHERE (lower((COALESCE(a.verify, ''::character varying))::text) = 'true'::text)))::integer) DESC
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=22564
  ->  Finalize GroupAggregate  (cost=27787.08..27791.42 rows=12 width=60) (actual time=180.478..185.819 rows=13.00 loops=1)
        Group Key: (COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text))
        Buffers: shared hit=22564
        ->  Gather Merge  (cost=27787.08..27790.45 rows=29 width=88) (actual time=180.466..185.794 rows=39.00 loops=1)
              Workers Planned: 2
              Workers Launched: 2
              Buffers: shared hit=22564
              ->  Sort  (cost=26787.05..26787.08 rows=12 width=88) (actual time=171.993..171.997 rows=13.00 loops=3)
                    Sort Key: (COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text))
                    Sort Method: quicksort  Memory: 26kB
                    Buffers: shared hit=22564
                    Worker 0:  Sort Method: quicksort  Memory: 26kB
                    Worker 1:  Sort Method: quicksort  Memory: 26kB
                    ->  Partial HashAggregate  (cost=26786.66..26786.84 rows=12 width=88) (actual time=171.941..171.946 rows=13.00 loops=3)
                          Group Key: COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text)
                          Batches: 1  Memory Usage: 32kB
                          Buffers: shared hit=22548
                          Worker 0:  Batches: 1  Memory Usage: 32kB
                          Worker 1:  Batches: 1  Memory Usage: 32kB
                          ->  Hash Left Join  (cost=1.27..23223.71 rows=36543 width=58) (actual time=0.094..51.827 rows=45901.00 loops=3)
                                Hash Cond: (a.faculty = f.id)
                                Buffers: shared hit=22548
                                ->  Parallel Seq Scan on tbl_alumni a  (cost=0.00..22910.43 rows=36543 width=34) (actual time=0.016..32.455 rows=45901.00 loops=3)
                                      Buffers: shared hit=22545
                                ->  Hash  (cost=1.12..1.12 rows=12 width=37) (actual time=0.065..0.066 rows=12.00 loops=3)
                                      Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                      Buffers: shared hit=3
                                      ->  Seq Scan on tbl_faculties f  (cost=0.00..1.12 rows=12 width=37) (actual time=0.050..0.053 rows=12.00 loops=3)
                                            Buffers: shared hit=3
Planning:
  Buffers: shared hit=7
Planning Time: 0.346 ms
Execution Time: 185.906 ms
```

## dash-faculty-locations — realtime-dashboard facultyLocationRows (province buckets)

- execution: **203.64 ms** · planning: 0.341 ms · wall: 207 ms
- scan nodes: Seq Scan:tbl_alumni, Seq Scan:tbl_faculties

```
Sort  (cost=27517.36..27517.39 rows=12 width=52) (actual time=196.188..203.559 rows=13.00 loops=1)
  Sort Key: ((count(*) FILTER (WHERE (lower((COALESCE(a.verify, ''::character varying))::text) = 'true'::text)))::integer) DESC
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=22564
  ->  Finalize GroupAggregate  (cost=27513.00..27517.15 rows=12 width=52) (actual time=196.157..203.549 rows=13.00 loops=1)
        Group Key: (COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text))
        Buffers: shared hit=22564
        ->  Gather Merge  (cost=27513.00..27516.38 rows=29 width=72) (actual time=196.146..203.528 rows=39.00 loops=1)
              Workers Planned: 2
              Workers Launched: 2
              Buffers: shared hit=22564
              ->  Sort  (cost=26512.98..26513.01 rows=12 width=72) (actual time=187.745..187.749 rows=13.00 loops=3)
                    Sort Key: (COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text))
                    Sort Method: quicksort  Memory: 26kB
                    Buffers: shared hit=22564
                    Worker 0:  Sort Method: quicksort  Memory: 26kB
                    Worker 1:  Sort Method: quicksort  Memory: 26kB
                    ->  Partial HashAggregate  (cost=26512.58..26512.76 rows=12 width=72) (actual time=187.693..187.698 rows=13.00 loops=3)
                          Group Key: COALESCE(NULLIF(TRIM(BOTH FROM f.faculty_name), ''::text), 'Under Processing'::text)
                          Batches: 1  Memory Usage: 32kB
                          Buffers: shared hit=22548
                          Worker 0:  Batches: 1  Memory Usage: 32kB
                          Worker 1:  Batches: 1  Memory Usage: 32kB
                          ->  Hash Left Join  (cost=1.27..23223.71 rows=36543 width=54) (actual time=0.109..52.365 rows=45901.00 loops=3)
                                Hash Cond: (a.faculty = f.id)
                                Buffers: shared hit=22548
                                ->  Parallel Seq Scan on tbl_alumni a  (cost=0.00..22910.43 rows=36543 width=30) (actual time=0.016..32.476 rows=45901.00 loops=3)
                                      Buffers: shared hit=22545
                                ->  Hash  (cost=1.12..1.12 rows=12 width=37) (actual time=0.077..0.078 rows=12.00 loops=3)
                                      Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                      Buffers: shared hit=3
                                      ->  Seq Scan on tbl_faculties f  (cost=0.00..1.12 rows=12 width=37) (actual time=0.063..0.065 rows=12.00 loops=3)
                                            Buffers: shared hit=3
Planning:
  Buffers: shared hit=4
Planning Time: 0.341 ms
Execution Time: 203.640 ms
```

## dash-chapter-counts — realtime-dashboard chapterAssocRows

- execution: **106.122 ms** · planning: 0.416 ms · wall: 109 ms
- scan nodes: Seq Scan:tblchapters, Seq Scan:tbl_alumni

```
Result  (cost=29671.66..29671.67 rows=1 width=16) (actual time=106.051..106.058 rows=1.00 loops=1)
  Buffers: shared hit=59196
  InitPlan 1
    ->  Aggregate  (cost=2.50..2.52 rows=1 width=4) (actual time=0.027..0.029 rows=1.00 loops=1)
          Buffers: shared hit=2
          ->  Seq Scan on tblchapters c  (cost=0.00..2.44 rows=28 width=0) (actual time=0.015..0.023 rows=14.00 loops=1)
                Filter: (TRIM(BOTH FROM COALESCE(national_chapter, ''::text)) <> ''::text)
                Rows Removed by Filter: 16
                Buffers: shared hit=2
  InitPlan 2
    ->  Aggregate  (cost=2.50..2.52 rows=1 width=4) (actual time=0.012..0.013 rows=1.00 loops=1)
          Buffers: shared hit=2
          ->  Seq Scan on tblchapters c_1  (cost=0.00..2.44 rows=28 width=0) (actual time=0.005..0.011 rows=16.00 loops=1)
                Filter: (TRIM(BOTH FROM COALESCE(international_chapter, ''::text)) <> ''::text)
                Rows Removed by Filter: 14
                Buffers: shared hit=2
  InitPlan 3
    ->  Aggregate  (cost=26023.42..26023.43 rows=1 width=4) (actual time=74.108..74.109 rows=1.00 loops=1)
          Buffers: shared hit=22548
          ->  Sort  (cost=25860.73..25942.07 rows=32538 width=8) (actual time=70.284..71.944 rows=32453.00 loops=1)
                Sort Key: a.association_id
                Sort Method: quicksort  Memory: 769kB
                Buffers: shared hit=22548
                ->  Seq Scan on tbl_alumni a  (cost=0.00..23422.03 rows=32538 width=8) (actual time=0.009..67.260 rows=32453.00 loops=1)
                      Filter: (association_id IS NOT NULL)
                      Rows Removed by Filter: 105250
                      Buffers: shared hit=22545
  InitPlan 4
    ->  Aggregate  (cost=3643.18..3643.20 rows=1 width=4) (actual time=31.895..31.896 rows=1.00 loops=1)
          Buffers: shared hit=36644
          ->  Merge Join  (cost=0.79..3613.36 rows=11929 width=4) (actual time=0.053..30.927 rows=11858.00 loops=1)
                Merge Cond: (ac.id = a_1.alumniid)
                Buffers: shared hit=36644
                ->  Index Only Scan using alumni_chapter_pkey on alumni_chapter ac  (cost=0.29..516.21 rows=11929 width=4) (actual time=0.033..4.063 rows=11858.00 loops=1)
                      Heap Fetches: 9742
                      Index Searches: 1
                      Buffers: shared hit=4545
                ->  Index Only Scan using tbl_alumni_pkey on tbl_alumni a_1  (cost=0.42..6635.96 rows=87703 width=4) (actual time=0.016..22.263 rows=37703.00 loops=1)
                      Heap Fetches: 35270
                      Index Searches: 1
                      Buffers: shared hit=32099
Planning:
  Buffers: shared hit=16
Planning Time: 0.416 ms
Execution Time: 106.122 ms
```

## dash-chapter-members-national — realtime-dashboard chapter member counts

- execution: **8.21 ms** · planning: 0.212 ms · wall: 11 ms
- scan nodes: Seq Scan:tblchapters, Bitmap Heap Scan:alumni_chapter, Index Scan:idx_alumni_chapter_chapter1, Index Scan:idx_alumni_chapter_chapter2, Index Scan:idx_alumni_chapter_chapter3

```
Sort  (cost=1229.12..1229.16 rows=14 width=36) (actual time=8.138..8.141 rows=14.00 loops=1)
  Sort Key: ((count(ac.id))::integer) DESC
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=786
  ->  HashAggregate  (cost=1228.64..1228.85 rows=14 width=36) (actual time=8.125..8.129 rows=14.00 loops=1)
        Group Key: TRIM(BOTH FROM c.national_chapter)
        Batches: 1  Memory Usage: 32kB
        Buffers: shared hit=786
        ->  Nested Loop Left Join  (cost=15.76..1170.02 rows=11724 width=36) (actual time=0.097..6.004 rows=11382.00 loops=1)
              Buffers: shared hit=786
              ->  Seq Scan on tblchapters c  (cost=0.00..2.44 rows=28 width=25) (actual time=0.014..0.027 rows=14.00 loops=1)
                    Filter: (TRIM(BOTH FROM COALESCE(national_chapter, ''::text)) <> ''::text)
                    Rows Removed by Filter: 16
                    Buffers: shared hit=2
              ->  Bitmap Heap Scan on alumni_chapter ac  (cost=15.76..36.46 rows=419 width=19) (actual time=0.061..0.181 rows=813.00 loops=14)
                    Recheck Cond: ((chapter1 = (c.id)::numeric) OR (chapter2 = (c.id)::numeric) OR (chapter3 = (c.id)::numeric))
                    Heap Blocks: exact=663
                    Buffers: shared hit=784
                    ->  BitmapOr  (cost=15.76..15.76 rows=420 width=0) (actual time=0.054..0.054 rows=0.00 loops=14)
                          Buffers: shared hit=121
                          ->  Bitmap Index Scan on idx_alumni_chapter_chapter1  (cost=0.00..8.32 rows=385 width=0) (actual time=0.042..0.042 rows=813.29 loops=14)
                                Index Cond: (chapter1 = (c.id)::numeric)
                                Index Searches: 14
                                Buffers: shared hit=63
                          ->  Bitmap Index Scan on idx_alumni_chapter_chapter2  (cost=0.00..3.67 rows=32 width=0) (actual time=0.008..0.008 rows=61.43 loops=14)
                                Index Cond: (chapter2 = (c.id)::numeric)
                                Index Searches: 14
                                Buffers: shared hit=30
                          ->  Bitmap Index Scan on idx_alumni_chapter_chapter3  (cost=0.00..3.46 rows=4 width=0) (actual time=0.002..0.002 rows=2.50 loops=14)
                                Index Cond: (chapter3 = (c.id)::numeric)
                                Index Searches: 14
                                Buffers: shared hit=28
Planning:
  Buffers: shared hit=6
Planning Time: 0.212 ms
Execution Time: 8.210 ms
```

## dash-card-status — realtime-dashboard card counts

- execution: **5.057 ms** · planning: 0.056 ms · wall: 7 ms
- scan nodes: Seq Scan:tblcard

```
Aggregate  (cost=265.20..265.22 rows=1 width=12) (actual time=5.033..5.034 rows=1.00 loops=1)
  Buffers: shared hit=123
  ->  Seq Scan on tblcard c  (cost=0.00..160.92 rows=3792 width=9) (actual time=0.010..0.679 rows=3774.00 loops=1)
        Buffers: shared hit=123
Planning Time: 0.056 ms
Execution Time: 5.057 ms
```

## dash-scholarship-counts — realtime-dashboard scholarship aggregate

- execution: **0.09 ms** · planning: 0.068 ms · wall: 2 ms
- scan nodes: Seq Scan:alumni_scholarships

```
Aggregate  (cost=17.16..17.17 rows=1 width=12) (actual time=0.071..0.072 rows=1.00 loops=1)
  Buffers: shared hit=16
  ->  Seq Scan on alumni_scholarships s  (cost=0.00..16.42 rows=42 width=9) (actual time=0.006..0.028 rows=43.00 loops=1)
        Buffers: shared hit=16
Planning:
  Buffers: shared hit=3
Planning Time: 0.068 ms
Execution Time: 0.090 ms
```
