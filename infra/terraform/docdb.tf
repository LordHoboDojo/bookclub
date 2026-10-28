# Amazon DocumentDB (MongoDB-compatible NoSQL). The app connects with the same Mongoose models
# it uses against the local mongo container.

resource "random_password" "docdb" {
  length  = 32
  special = false # DocumentDB rejects / " @ in master passwords
}

resource "aws_docdb_subnet_group" "main" {
  name       = "${local.name}-docdb"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_docdb_cluster_parameter_group" "main" {
  name   = "${local.name}-docdb5"
  family = "docdb5.0"

  parameter {
    name  = "tls"
    value = "enabled"
  }
}

resource "aws_docdb_cluster" "main" {
  cluster_identifier              = "${local.name}-docdb"
  engine                          = "docdb"
  engine_version                  = "5.0.0"
  master_username                 = "bookclub"
  master_password                 = random_password.docdb.result
  db_subnet_group_name            = aws_docdb_subnet_group.main.name
  db_cluster_parameter_group_name = aws_docdb_cluster_parameter_group.main.name
  vpc_security_group_ids          = [aws_security_group.docdb.id]
  storage_encrypted               = true
  backup_retention_period         = 7
  deletion_protection             = var.docdb_deletion_protection
  skip_final_snapshot             = true
}

resource "aws_docdb_cluster_instance" "main" {
  count              = var.docdb_instance_count
  identifier         = "${local.name}-docdb-${count.index}"
  cluster_identifier = aws_docdb_cluster.main.id
  instance_class     = var.docdb_instance_class
}
