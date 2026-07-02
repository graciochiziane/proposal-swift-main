import psycopg2

conn_str = "postgresql://postgres.ewlkdrwrespnxyddwtgo:OperaOmnia#89@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"

conn = psycopg2.connect(conn_str)
conn.autocommit = True
with conn.cursor() as cur:
    # Check if RPC exists
    cur.execute("""
        SELECT routine_name FROM information_schema.routines
        WHERE routine_schema='public' AND routine_name = 'get_invitation_by_token';
    """)
    print('RPC exists:', cur.fetchone())

    # List all public functions
    cur.execute("""
        SELECT routine_name FROM information_schema.routines
        WHERE routine_schema='public'
        ORDER BY routine_name;
    """)
    for row in cur.fetchall():
        print(row[0])
conn.close()