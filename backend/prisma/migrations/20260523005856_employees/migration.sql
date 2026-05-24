-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(30),
    "email" VARCHAR(100),
    "address" TEXT,
    "photo_url" TEXT,
    "position" VARCHAR(60),
    "contract_type" VARCHAR(20),
    "hire_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "salary" INTEGER,
    "salary_period" VARCHAR(15),
    "payment_method" VARCHAR(20),
    "emergency_contact" VARCHAR(100),
    "emergency_phone" VARCHAR(30),
    "id_number" VARCHAR(50),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "idx_employees_active" ON "employees"("is_active");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
