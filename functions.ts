// example 1 - get top sependers
export async function getTopSpendingRaw(connection: any): Promise<any> {
  const query = `
        SELECT 
          u.name,
          COUNT(DISTINCT o.id) as order_count,
          ROUND(SUM(oi.quantity * oi.unit_price), 2) as total_spent,
          ROUND(AVG(oi.unit_price), 2) as avg_item_price
        FROM User u
        LEFT JOIN \`Order\` o ON u.id = o.user_id
        LEFT JOIN OrderItem oi ON o.id = oi.order_id
        GROUP BY u.id, u.name
        HAVING total_spent > 1000
        ORDER BY total_spent DESC, u.name
        LIMIT 10
      `;
  const [rows] = await connection.execute(query);
  return rows;
}

export async function getTopSpendingPrisma(prisma: any) {
  const result = await prisma.user.findMany({
    where: {
      orders: {
        some: {
          order_items: {
            some: {},
          },
        },
      },
    },
    select: {
      name: true,
      orders: {
        select: {
          _count: {
            select: {
              order_items: true,
            },
          },
          order_items: {
            select: {
              quantity: true,
              unit_price: true,
            },
          },
        },
      },
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });

  const processedResults = result.map((user: any) => {
    const totalSpent = user.orders.reduce((orderSum: any, order: any) => {
      return (
        orderSum +
        order.order_items.reduce((itemSum: any, item: any) => {
          return itemSum + item.quantity * item.unit_price;
        }, 0)
      );
    }, 0);

    const allItemPrices = user.orders.flatMap((order: any) =>
      order.order_items.map((item: any) => item.unit_price)
    );

    return {
      name: user.name,
      order_count: user._count.orders,
      total_spent: Math.round(totalSpent * 100) / 100,
      avg_item_price: allItemPrices.length
        ? Math.round(
            (allItemPrices.reduce(
              (sum: any, price: any) => Number(sum) + Number(price),
              0
            ) /
              allItemPrices.length) *
              100
          ) / 100
        : 0,
    };
  });

  return processedResults
    .filter((user: any) => user.total_spent > 1000)
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
    .sort((a: any, b: any) => b.total_spent - a.total_spent)
    .slice(0, 10);
}

// example 2 - get count of users who have made orders in different price ranges
export async function getCountForSpenderCategoryRaw(connection: any) {
  const query = `
        SELECT 
        COUNT(DISTINCT CASE WHEN total_amount < 100 THEN user_id END) as low_spenders,
        COUNT(DISTINCT CASE WHEN total_amount >= 100 AND total_amount < 500 THEN user_id END) as mid_spenders,
        COUNT(DISTINCT CASE WHEN total_amount >= 500 THEN user_id END) as high_spenders
        FROM \`Order\`
        WHERE status = 'completed'
    `;

  const [rows] = await connection.execute(query);
  return rows;
}

export async function getCountForSpenderCategoryPrisma(prisma: any) {
  const lowSpenders = await prisma.order.findMany({
    where: {
      status: "completed",
      total_amount: { lt: 100 },
    },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  const midSpenders = await prisma.order.findMany({
    where: {
      status: "completed",
      total_amount: {
        gte: 100,
        lt: 500,
      },
    },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  const highSpenders = await prisma.order.findMany({
    where: {
      status: "completed",
      total_amount: { gte: 500 },
    },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  const rows = {
    low_spenders: lowSpenders.length,
    mid_spenders: midSpenders.length,
    high_spenders: highSpenders.length,
  };

  return rows;
}

// example 3 - get last 10 week sales
export async function getLast10WeekSalesRaw(connection: any) {
  const query = `
    SELECT 
    DATE_FORMAT(created_at, '%Y-Week %u') as week,
    COUNT(*) as order_count,
    SUM(total_amount) as revenue
    FROM \`Order\`
    WHERE status = 'completed'
    GROUP BY DATE_FORMAT(created_at, '%Y-Week %u')
    ORDER BY week DESC
    LIMIT 10
    `;

  const [rows] = await connection.execute(query);
  return rows;
}

export async function getLast10WeekSalesPrisma(prisma: any) {
  const orders = await prisma.order.findMany({
    where: {
      status: "completed",
    },
    select: {
      created_at: true,
      total_amount: true,
    },
  });

  // Have to process dates and grouping in JavaScript
  const weeklyOrders = orders.reduce((acc: any, order: any) => {
    const week = `${order.created_at.getFullYear()}-Week ${getWeekNumber(
      order.created_at
    )}`;
    if (!acc[week]) {
      acc[week] = { order_count: 0, revenue: 0 };
    }
    acc[week].order_count++;
    acc[week].revenue += Number(order.total_amount);
    return acc;
  }, {});

  let rows = Object.entries(weeklyOrders)
    .map(([week, stats]: [any, any]) => ({
      week,
      ...stats,
    }))
    .sort((a, b) => b.week.localeCompare(a.week))
    .slice(0, 10);
  return rows;
}

// Helper function for week number calculation
function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
